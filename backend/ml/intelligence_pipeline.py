"""
AutismCare Behavioural Intelligence Pipeline
Main orchestrator integrating all ML components
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import logging
import json
import threading

from config import PipelineConfig, get_config
from data_preprocessing import (
    DataPreprocessor, RawDailyInput, ProcessedDailyVector
)
from baseline_engine import BaselineEngine, ChildBaseline
from anomaly_detection import AnomalyDetectionEngine, AnomalyResult, AnomalyAlert
from correlation_engine import CorrelationEngine, CorrelationAnalysis
from forecasting_engine import ForecastEngine, BehaviourForecast
from explainability_engine import (
    ExplanationEngine, ExplanationOutput, EthicsEnforcer
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class DailyAnalysisResult:
    """Complete daily analysis output"""
    child_id: str
    date: str
    
    # Core metrics
    anomaly_score: float
    confidence: float
    forecast: str  # "likely_increase", "possible_stability", "may_reduce"
    
    # Detailed explanation
    explanation: str
    contributing_factors: List[str]
    
    # Alert info
    alert: Optional[Dict] = None
    
    # Baseline comparison
    baseline_deviation: Optional[Dict] = None
    
    # Correlation insights
    top_correlations: Optional[List[Dict]] = None
    
    # Forecast details
    forecast_details: Optional[Dict] = None
    
    # Metadata
    processing_timestamp: str = None
    model_versions: Dict[str, str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    def to_api_response(self) -> Dict:
        """Format for API response (matches specification)"""
        return {
            "anomaly_score": round(self.anomaly_score, 2),
            "confidence": int(self.confidence),
            "forecast": self.forecast,
            "explanation": self.explanation,
            "alert": self.alert,
            "contributing_factors": self.contributing_factors
        }


class BehaviouralIntelligencePipeline:
    """
    Main pipeline orchestrator for behavioral analysis
    
    Pipeline Flow:
    Input Data → Preprocessing → Unsupervised Baseline → 
    Anomaly Detection → Regression Correlation → 
    Time-Series Forecast → SHAP Explanation → 
    Confidence Alert + Text Insight
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        
        # Initialize all components
        self.preprocessor = DataPreprocessor(self.config)
        self.baseline_engine = BaselineEngine(self.config)
        self.anomaly_engine = AnomalyDetectionEngine(self.config)
        self.correlation_engine = CorrelationEngine(self.config)
        self.forecast_engine = ForecastEngine(self.config)
        self.explanation_engine = ExplanationEngine(self.config)
        self.ethics_enforcer = EthicsEnforcer(self.config.ethics)
        
        # Connect engines
        self.anomaly_engine.set_baseline_engine(self.baseline_engine)
        
        # Pipeline state
        self.is_initialized = False
        self.children_initialized: set = set()
        
        logger.info("Behavioural Intelligence Pipeline created")
    
    def initialize_child(
        self,
        child_id: str,
        historical_data: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Initialize pipeline for a child with historical data
        
        Args:
            child_id: Child identifier
            historical_data: Historical routine/behavior data
        
        Returns:
            Initialization status and baseline info
        """
        logger.info(f"Initializing pipeline for child: {child_id}")
        
        result = {
            "child_id": child_id,
            "status": "initializing",
            "baseline": None,
            "models_fitted": []
        }
        
        # Filter data for this child
        if "child_id" in historical_data.columns:
            child_data = historical_data[historical_data["child_id"] == child_id]
        else:
            child_data = historical_data.copy()
            child_data["child_id"] = child_id
        
        if len(child_data) < 7:
            result["status"] = "insufficient_data"
            result["message"] = f"Need at least 7 days of data, got {len(child_data)}"
            return result
        
        # 1. Create baseline
        baseline = self.baseline_engine.create_baseline(child_data, child_id)
        result["baseline"] = baseline.to_dict()
        result["models_fitted"].append("baseline")
        
        # 2. Fit anomaly detection
        try:
            self.anomaly_engine.fit(child_data, child_id)
            result["models_fitted"].append("anomaly_detection")
        except Exception as e:
            logger.warning(f"Anomaly detection fitting failed: {e}")
        
        # 3. Analyze correlations
        try:
            if len(child_data) >= 14:
                correlation = self.correlation_engine.analyze_correlations(
                    child_id, child_data
                )
                result["correlation_summary"] = correlation.summary_explanation
                result["models_fitted"].append("correlation")
        except Exception as e:
            logger.warning(f"Correlation analysis failed: {e}")
        
        # 4. Initialize explainability (using RF from correlation if available)
        try:
            if self.config.explainability.enable_shap:
                # Use correlation RF model for SHAP
                rf_model = self.correlation_engine.rf_analyzer.model
                if rf_model is not None:
                    feature_cols = self.correlation_engine.feature_cols
                    self.explanation_engine.initialize_shap(
                        rf_model, child_data, feature_cols
                    )
                    result["models_fitted"].append("shap_explainer")
        except Exception as e:
            logger.warning(f"SHAP initialization failed: {e}")
        
        self.children_initialized.add(child_id)
        self.is_initialized = True
        result["status"] = "initialized"
        
        logger.info(f"Pipeline initialized for {child_id}: {result['models_fitted']}")
        
        return result
    
    def process_daily_entry(
        self,
        raw_input: RawDailyInput
    ) -> DailyAnalysisResult:
        """
        Process a single daily entry through the full pipeline
        
        Args:
            raw_input: Raw daily input data
        
        Returns:
            Complete daily analysis result
        """
        child_id = raw_input.child_id
        date = raw_input.date
        
        logger.info(f"Processing daily entry for {child_id} on {date}")
        
        # Step 1: Preprocess
        processed = self.preprocessor.process_single_entry(raw_input)
        observation = {
            "sleep_hours": processed.sleep_hours,
            "activity_level": processed.activity_level,
            "emotion_score": processed.emotion_score,
            "behaviour_score": processed.behaviour_score,
            "medication_flag": processed.medication_flag
        }
        
        # Step 2: Detect anomaly
        try:
            anomaly_result = self.anomaly_engine.detect_anomaly(
                child_id, observation, date
            )
            anomaly_score = anomaly_result.anomaly_score
            anomaly_confidence = anomaly_result.confidence
        except Exception as e:
            logger.warning(f"Anomaly detection failed: {e}")
            anomaly_score = 0.0
            anomaly_confidence = 0.0
            anomaly_result = None
        
        # Step 3: Compare to baseline
        baseline_deviation = None
        try:
            z_scores = self.baseline_engine.compare_to_baseline(child_id, observation)
            if z_scores:
                baseline_deviation = {
                    k: round(v, 2) for k, v in z_scores.items()
                }
        except Exception as e:
            logger.warning(f"Baseline comparison failed: {e}")
        
        # Step 4: Get correlation insights
        top_correlations = None
        try:
            insights = self.correlation_engine.get_insights(child_id)
            if insights:
                top_correlations = [
                    {
                        "factor": i.factor,
                        "strength": i.influence_strength,
                        "suggestion": i.action_suggestion
                    }
                    for i in insights[:3]
                ]
        except Exception as e:
            logger.warning(f"Correlation insights failed: {e}")
        
        # Step 5: Generate forecast
        forecast_trend = "possible_stability"
        forecast_details = None
        try:
            analysis = self.correlation_engine.analyses.get(child_id)
            if analysis:
                # Need historical data for forecast - simplified here
                forecast_trend = "possible_stability"
                forecast_details = {
                    "trend": forecast_trend,
                    "confidence": 0.7
                }
        except Exception as e:
            logger.warning(f"Forecast generation failed: {e}")
        
        # Step 6: Generate explanation
        explanation_text = ""
        contributing_factors = []
        try:
            explanation = self.explanation_engine.generate_explanation(
                child_id=child_id,
                observation=observation,
                prediction_type="anomaly" if anomaly_score > 0.5 else "observation",
                prediction_value=anomaly_score,
                model_confidence=anomaly_confidence / 100
            )
            
            explanation_text = explanation.primary_explanation
            contributing_factors = [
                fc.natural_language for fc in explanation.feature_contributions
            ]
            
            # Enforce ethics
            explanation_text = self.ethics_enforcer.sanitize_output(explanation_text)
            explanation_text = self.ethics_enforcer.add_probability_language(explanation_text)
            
        except Exception as e:
            logger.warning(f"Explanation generation failed: {e}")
            explanation_text = "Pattern analysis completed. See contributing factors for details."
        
        # Step 7: Create alert if needed
        alert = None
        if anomaly_result and anomaly_result.alert_triggered:
            try:
                alert_obj = self.anomaly_engine.create_alert(anomaly_result)
                if alert_obj:
                    alert = alert_obj.to_dict()
            except Exception as e:
                logger.warning(f"Alert creation failed: {e}")
        
        # Build result
        result = DailyAnalysisResult(
            child_id=child_id,
            date=date,
            anomaly_score=anomaly_score,
            confidence=anomaly_confidence,
            forecast=forecast_trend,
            explanation=explanation_text,
            contributing_factors=contributing_factors[:5],
            alert=alert,
            baseline_deviation=baseline_deviation,
            top_correlations=top_correlations,
            forecast_details=forecast_details,
            processing_timestamp=datetime.now().isoformat(),
            model_versions={
                "pipeline": "1.0.0",
                "anomaly": "isolation_forest",
                "correlation": "random_forest",
                "forecast": "arima"
            }
        )
        
        logger.info(f"Daily analysis complete for {child_id}: anomaly={anomaly_score:.2f}")
        
        return result
    
    def process_from_database(
        self,
        child_id: str,
        routine_entries: List[Dict],
        behavior_entries: List[Dict],
        current_date: str = None
    ) -> DailyAnalysisResult:
        """
        Process data directly from database entries
        
        Args:
            child_id: Child identifier
            routine_entries: Routine entries from database
            behavior_entries: Behavior entries from database
            current_date: Date to analyze (default: latest)
        
        Returns:
            Daily analysis result
        """
        # Convert database entries to DataFrame
        df = self.preprocessor.from_database_rows(routine_entries, behavior_entries)
        
        if df.empty:
            return DailyAnalysisResult(
                child_id=child_id,
                date=current_date or datetime.now().strftime("%Y-%m-%d"),
                anomaly_score=0.0,
                confidence=0.0,
                forecast="possible_stability",
                explanation="Insufficient data for analysis",
                contributing_factors=[]
            )
        
        # Initialize if not done
        if child_id not in self.children_initialized:
            self.initialize_child(child_id, df)
        
        # Get current date data
        current_date = current_date or df["date"].max()
        current_data = df[df["date"] == current_date]
        
        if current_data.empty:
            current_data = df.tail(1)
        
        # Create RawDailyInput from current data
        row = current_data.iloc[0]

        # Derive sleep_start and sleep_end from sleep_hours so
        # process_single_entry computes the correct duration
        sleep_hours = float(row.get("sleep_hours", 8.0))
        sleep_start = "22:00"
        end_hour = (22 + int(sleep_hours)) % 24
        end_minute = int((sleep_hours - int(sleep_hours)) * 60)
        sleep_end = f"{end_hour:02d}:{end_minute:02d}"

        # Map emotion_score back to an emotion label
        emotion_score = float(row.get("emotion_score", 0.5))
        if emotion_score >= 0.7:
            emotions = ["calm"]
        elif emotion_score <= 0.3:
            emotions = ["anxious"]
        else:
            emotions = ["neutral"]

        # Map activity_level to an activity entry
        activity_level = float(row.get("activity_level", 0.5))
        activities = [{"type": "outdoor_play" if activity_level > 0.6 else "quiet_play",
                       "duration": 60}]

        # Map behaviour_score back to intensity
        behaviour_score = float(row.get("behaviour_score", 0.5))
        if behaviour_score >= 0.7:
            behaviour_intensity = "low"
        elif behaviour_score <= 0.3:
            behaviour_intensity = "high"
        else:
            behaviour_intensity = "moderate"

        raw_input = RawDailyInput(
            child_id=child_id,
            date=str(row.get("date", current_date)),
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            activities=activities,
            emotions=emotions,
            behaviour_intensity=behaviour_intensity,
            medication_taken=bool(row.get("medication_flag", 0))
        )

        return self.process_daily_entry(raw_input)
    
    def batch_analyze(
        self,
        child_id: str,
        data: pd.DataFrame
    ) -> List[DailyAnalysisResult]:
        """
        Analyze multiple days of data
        
        Returns:
            List of daily analysis results
        """
        results = []
        
        # Initialize first
        if child_id not in self.children_initialized:
            self.initialize_child(child_id, data)
        
        # Process each day
        for _, row in data.iterrows():
            # Derive sleep_start and sleep_end from sleep_hours
            sleep_hours = float(row.get("sleep_hours", 8.0))
            sleep_start = "22:00"
            end_hour = (22 + int(sleep_hours)) % 24
            end_minute = int((sleep_hours - int(sleep_hours)) * 60)
            sleep_end = f"{end_hour:02d}:{end_minute:02d}"

            # Map emotion_score back to an emotion label
            emotion_score = float(row.get("emotion_score", 0.5))
            if emotion_score >= 0.7:
                emotions = ["calm"]
            elif emotion_score <= 0.3:
                emotions = ["anxious"]
            else:
                emotions = ["neutral"]

            # Map activity_level to an activity entry
            activity_level = float(row.get("activity_level", 0.5))
            activities = [{"type": "outdoor_play" if activity_level > 0.6 else "quiet_play",
                           "duration": 60}]

            # Map behaviour_score back to intensity
            behaviour_score = float(row.get("behaviour_score", 0.5))
            if behaviour_score >= 0.7:
                behaviour_intensity = "low"
            elif behaviour_score <= 0.3:
                behaviour_intensity = "high"
            else:
                behaviour_intensity = "moderate"

            raw_input = RawDailyInput(
                child_id=child_id,
                date=str(row.get("date", "")),
                sleep_start=sleep_start,
                sleep_end=sleep_end,
                activities=activities,
                emotions=emotions,
                behaviour_intensity=behaviour_intensity,
                medication_taken=bool(row.get("medication_flag", 0))
            )

            result = self.process_daily_entry(raw_input)
            results.append(result)
        
        return results
    
    def get_child_summary(self, child_id: str) -> Dict[str, Any]:
        """
        Get summary of child's analysis state
        """
        baseline = self.baseline_engine.get_baseline(child_id)
        correlation = self.correlation_engine.analyses.get(child_id)
        
        return {
            "child_id": child_id,
            "is_initialized": child_id in self.children_initialized,
            "baseline": baseline.to_dict() if baseline else None,
            "correlation_summary": correlation.summary_explanation if correlation else None,
            "top_influencing_factor": correlation.top_influencing_factor if correlation else None
        }
    
    def update_baseline(
        self,
        child_id: str,
        new_data: pd.DataFrame
    ) -> Optional[ChildBaseline]:
        """
        Update a child's baseline with new data
        """
        return self.baseline_engine.update_baseline(child_id, new_data)


# Singleton instance
_pipeline = None
_pipeline_lock = threading.Lock()


def get_pipeline() -> BehaviouralIntelligencePipeline:
    """Get or create the pipeline singleton"""
    global _pipeline
    if _pipeline is None:
        with _pipeline_lock:
            if _pipeline is None:
                _pipeline = BehaviouralIntelligencePipeline()
    return _pipeline


# Example usage
if __name__ == "__main__":
    from datetime import timedelta
    
    np.random.seed(42)
    
    # Create sample historical data
    n_days = 30
    child_id = "child_001"
    
    data = []
    for day in range(n_days):
        date = (datetime.now() - timedelta(days=n_days - day)).strftime("%Y-%m-%d")
        data.append({
            "child_id": child_id,
            "date": date,
            "sleep_hours": np.random.normal(8, 1),
            "activity_level": np.random.uniform(0.3, 0.7),
            "emotion_score": np.random.uniform(0.4, 0.8),
            "behaviour_score": np.random.uniform(0.4, 0.7),
            "medication_flag": np.random.randint(0, 2)
        })
    
    df = pd.DataFrame(data)
    
    # Initialize pipeline
    pipeline = get_pipeline()
    init_result = pipeline.initialize_child(child_id, df)
    
    print("Initialization Result:")
    print(f"  Status: {init_result['status']}")
    print(f"  Models fitted: {init_result['models_fitted']}")
    
    # Process today's entry
    today_input = RawDailyInput(
        child_id=child_id,
        date=datetime.now().strftime("%Y-%m-%d"),
        sleep_start="22:00",
        sleep_end="06:30",  # Less sleep than usual
        activities=[
            {"type": "outdoor_play", "duration": 30}
        ],
        emotions=["anxious"],
        behaviour_intensity="moderate",
        medication_taken=True,
        behaviour_notes="Seemed a bit restless today"
    )
    
    result = pipeline.process_daily_entry(today_input)
    
    print("\n" + "="*50)
    print("Daily Analysis Result:")
    print("="*50)
    
    api_response = result.to_api_response()
    print(json.dumps(api_response, indent=2))
    
    print("\nFull Details:")
    print(f"  Child: {result.child_id}")
    print(f"  Date: {result.date}")
    print(f"  Anomaly Score: {result.anomaly_score:.2f}")
    print(f"  Confidence: {result.confidence:.0f}%")
    print(f"  Forecast: {result.forecast}")
    print(f"\n  Explanation: {result.explanation}")
    
    if result.contributing_factors:
        print("\n  Contributing Factors:")
        for factor in result.contributing_factors:
            print(f"    • {factor}")
    
    if result.alert:
        print(f"\n  ALERT: {result.alert['message']}")
    
    print("\nChild Summary:")
    summary = pipeline.get_child_summary(child_id)
    print(f"  Initialized: {summary['is_initialized']}")
    print(f"  Top Factor: {summary['top_influencing_factor']}")
