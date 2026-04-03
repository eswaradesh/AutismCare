"""
AutismCare ML Service (v2.0)
Main integration layer for all ML models including the new Behavioural Intelligence Pipeline

This service provides:
1. Legacy alert analysis and suggestions (backward compatible)
2. NEW: Complete behavioural intelligence pipeline with:
   - Personalized baselines
   - Anomaly detection
   - Correlation analysis
   - Forecasting
   - Explainable AI
"""

from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import asdict
import logging
import threading

# Legacy components
from behavior_alert_analyzer import BehaviorAlertAnalyzer, BehaviorAlert
from activity_suggestion_generator import ActivitySuggestionGenerator
from appointment_optimizer import AppointmentSchedulingOptimizer, TherapistSlot, AppointmentPreference
from auto_intensity_alerts import AutoIntensityAlertDetector

# New Behavioural Intelligence Pipeline
from intelligence_pipeline import get_pipeline, BehaviouralIntelligencePipeline
from data_preprocessing import RawDailyInput, DataPreprocessor
from config import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AutismCareMLService:
    """
    Unified ML service for AutismCare (v2.0)
    
    Provides methods for:
    - Legacy: Alert analysis, activity suggestions, appointment optimization
    - New: Behavioural intelligence pipeline with explainable AI
    """
    
    def __init__(self):
        # Legacy components
        self.alert_analyzer = BehaviorAlertAnalyzer()
        self.suggestion_generator = ActivitySuggestionGenerator()
        self.appointment_optimizer = AppointmentSchedulingOptimizer()
        self.intensity_detector = AutoIntensityAlertDetector()
        
        # New: Behavioural Intelligence Pipeline
        self.bi_pipeline = get_pipeline()
        self.preprocessor = DataPreprocessor()
        
        logger.info("AutismCare ML Service v2.0 initialized")
    
    # ==================== LEGACY: ALERT ANALYSIS ====================
    
    def analyze_alert_priority(
        self,
        alert: Dict,
        recent_alerts: List[Dict],
        baseline_intensity: float = 0.3
    ) -> Dict:
        """
        Analyze alert priority and severity (Legacy)
        """
        alert_obj = BehaviorAlert(**alert)
        recent = [BehaviorAlert(**a) for a in recent_alerts]
        
        priority = self.alert_analyzer.analyze_alert_priority(
            alert_obj, recent, baseline_intensity
        )
        
        return asdict(priority)
    
    def batch_analyze_alerts(
        self,
        alerts: List[Dict],
        baseline_intensity: float = 0.3
    ) -> List[Dict]:
        """Analyze multiple alerts and rank by priority (Legacy)"""
        alert_objs = [BehaviorAlert(**a) for a in alerts]
        priorities = self.alert_analyzer.batch_analyze_alerts(alert_objs, baseline_intensity)
        return [asdict(p) for p in priorities]
    
    # ==================== LEGACY: ACTIVITY SUGGESTIONS ====================
    
    def generate_activity_suggestions(
        self,
        behavior_entries: List[Dict],
        routine_entries: List[Dict],
        child_profile: Optional[Dict] = None,
        therapist_notes: Optional[List[str]] = None,
        top_n: int = 5
    ) -> List[Dict]:
        """Generate personalized activity suggestions (Legacy)"""
        patterns = self.suggestion_generator.detect_behavior_patterns(
            behavior_entries, routine_entries
        )
        
        suggestions = self.suggestion_generator.generate_suggestions(patterns, top_n)
        
        if child_profile and therapist_notes:
            suggestions = self.suggestion_generator.personalize_suggestions(
                suggestions, child_profile, therapist_notes
            )
        
        return [asdict(s) for s in suggestions]
    
    # ==================== LEGACY: APPOINTMENT SCHEDULING ====================
    
    def find_optimal_appointments(
        self,
        available_slots: List[Dict],
        parent_preference: Dict,
        behavior_entries: List[Dict],
        desired_date_str: str
    ) -> List[Dict]:
        """Find optimal appointment slots (Legacy)"""
        slot_objs = [TherapistSlot(**s) for s in available_slots]
        pref_obj = AppointmentPreference(**parent_preference)
        
        child_profile = self.appointment_optimizer.detect_child_behavior_profile(behavior_entries)
        desired_date = datetime.fromisoformat(desired_date_str)
        
        appointments = self.appointment_optimizer.find_optimal_slots(
            slot_objs, pref_obj, child_profile, desired_date
        )
        
        return [asdict(a) for a in appointments]
    
    # ==================== LEGACY: AUTO INTENSITY ALERTS ====================
    
    def check_auto_intensity_alert(
        self,
        new_entry: Dict,
        child_id: str,
        parent_id: str,
        therapist_ids: List[str],
        recent_entries: Optional[List[Dict]] = None
    ) -> Optional[Dict]:
        """Check if behavior entry triggers automatic alert (Legacy)"""
        alert = self.intensity_detector.analyze_single_entry(
            new_entry, child_id, parent_id, therapist_ids, recent_entries
        )
        
        if alert:
            return asdict(alert)
        return None
    
    # ==================== NEW: BEHAVIOURAL INTELLIGENCE PIPELINE ====================
    
    def initialize_child_pipeline(
        self,
        child_id: str,
        routine_entries: List[Dict],
        behavior_entries: List[Dict]
    ) -> Dict[str, Any]:
        """
        Initialize the behavioural intelligence pipeline for a child
        
        Args:
            child_id: Child identifier
            routine_entries: Historical routine entries
            behavior_entries: Historical behavior entries
        
        Returns:
            Initialization status with baseline info
        """
        # Convert to DataFrame
        df = self.preprocessor.from_database_rows(routine_entries, behavior_entries)
        
        if df.empty:
            return {
                "status": "error",
                "message": "No data available for initialization"
            }
        
        return self.bi_pipeline.initialize_child(child_id, df)
    
    def analyze_daily_behaviour(
        self,
        child_id: str,
        date: str,
        sleep_start: Optional[str] = None,
        sleep_end: Optional[str] = None,
        activities: Optional[List[Dict]] = None,
        emotions: Optional[List[str]] = None,
        behaviour_notes: Optional[str] = None,
        behaviour_intensity: str = "moderate",
        medication_taken: bool = False,
        voice_note_text: Optional[str] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Analyze daily behaviour with full explainability
        
        Returns API response format:
        {
            "anomaly_score": 0.72,
            "confidence": 85,
            "forecast": "likely increase",
            "explanation": "Reduced sleep contributed most"
        }
        """
        raw_input = RawDailyInput(
            child_id=child_id,
            date=date,
            sleep_start=sleep_start,
            sleep_end=sleep_end,
            activities=activities,
            emotions=emotions,
            behaviour_notes=behaviour_notes,
            behaviour_intensity=behaviour_intensity,
            medication_taken=medication_taken,
            voice_note_text=voice_note_text,
            language=language
        )
        
        result = self.bi_pipeline.process_daily_entry(raw_input)
        return result.to_api_response()
    
    def get_child_baseline(self, child_id: str) -> Optional[Dict]:
        """Get personalized baseline for a child"""
        baseline = self.bi_pipeline.baseline_engine.get_baseline(child_id)
        return baseline.to_dict() if baseline else None
    
    def get_correlation_analysis(self, child_id: str) -> Optional[Dict]:
        """Get routine-behavior correlation analysis"""
        analysis = self.bi_pipeline.correlation_engine.analyses.get(child_id)
        return analysis.to_dict() if analysis else None
    
    def get_child_summary(self, child_id: str) -> Dict[str, Any]:
        """Get complete summary of child's analysis state"""
        return self.bi_pipeline.get_child_summary(child_id)
    
    def generate_forecast(
        self,
        child_id: str,
        routine_entries: List[Dict],
        behavior_entries: List[Dict]
    ) -> Optional[Dict]:
        """
        Generate short-term behavior forecast
        
        Returns forecast for 1, 3, and 7 days ahead with confidence
        """
        df = self.preprocessor.from_database_rows(routine_entries, behavior_entries)
        
        if df.empty or len(df) < 14:
            return None
        
        try:
            forecast = self.bi_pipeline.forecast_engine.generate_forecast(child_id, df)
            return forecast.to_dict()
        except Exception as e:
            logger.error(f"Forecast generation failed: {e}")
            return None
    
    def get_correlation_insights(self, child_id: str) -> List[Dict]:
        """Get actionable insights from correlation analysis"""
        insights = self.bi_pipeline.correlation_engine.get_insights(child_id)
        return [
            {
                "factor": i.factor,
                "strength": i.influence_strength,
                "type": i.influence_type,
                "explanation": i.explanation,
                "action_suggestion": i.action_suggestion
            }
            for i in insights
        ]
    
    def update_child_baseline(
        self,
        child_id: str,
        new_routine_entries: List[Dict],
        new_behavior_entries: List[Dict]
    ) -> Optional[Dict]:
        """Update baseline with new data"""
        df = self.preprocessor.from_database_rows(new_routine_entries, new_behavior_entries)
        
        if df.empty:
            return None
        
        baseline = self.bi_pipeline.update_baseline(child_id, df)
        return baseline.to_dict() if baseline else None
    
    def get_pipeline_status(self) -> Dict[str, Any]:
        """Get status of the behavioural intelligence pipeline"""
        return {
            "initialized": self.bi_pipeline.is_initialized,
            "children_count": len(self.bi_pipeline.children_initialized),
            "children": list(self.bi_pipeline.children_initialized),
            "config": {
                "anomaly_model": self.bi_pipeline.anomaly_engine.active_model_type.value,
                "enable_shap": self.bi_pipeline.config.explainability.enable_shap,
                "enable_multilingual": self.bi_pipeline.config.enable_multilingual
            }
        }


# Singleton instance
_ml_service = None
_ml_service_lock = threading.Lock()


def get_ml_service() -> AutismCareMLService:
    """Get or create ML service singleton"""
    global _ml_service
    if _ml_service is None:
        with _ml_service_lock:
            if _ml_service is None:
                _ml_service = AutismCareMLService()
    return _ml_service


# Example usage and testing
if __name__ == "__main__":
    import numpy as np
    from datetime import timedelta
    
    print("="*60)
    print("AutismCare ML Service v2.0 - Demo")
    print("="*60)
    
    service = get_ml_service()
    
    print("\nAvailable Methods:")
    print("\nLegacy Methods:")
    print("  - analyze_alert_priority()")
    print("  - batch_analyze_alerts()")
    print("  - generate_activity_suggestions()")
    print("  - find_optimal_appointments()")
    print("  - check_auto_intensity_alert()")
    
    print("\nNew Behavioural Intelligence Methods:")
    print("  - initialize_child_pipeline()")
    print("  - analyze_daily_behaviour()")
    print("  - get_child_baseline()")
    print("  - get_correlation_analysis()")
    print("  - generate_forecast()")
    print("  - get_correlation_insights()")
    print("  - get_child_summary()")
    print("  - update_child_baseline()")
    print("  - get_pipeline_status()")
    
    # Demo: Initialize with mock data
    print("\n" + "-"*60)
    print("Demo: Initializing pipeline with sample data...")
    
    # Create mock historical data
    routine_entries = []
    behavior_entries = []
    
    np.random.seed(42)
    for day in range(30):
        date = (datetime.now() - timedelta(days=30-day)).strftime("%Y-%m-%d")
        
        routine_entries.append({
            "child_id": "demo_child",
            "date": date,
            "type": "sleep",
            "start_time": "21:00",
            "end_time": "07:00"
        })
        
        behavior_entries.append({
            "child_id": "demo_child",
            "date": date,
            "emotion": np.random.choice(["calm", "happy", "anxious"]),
            "intensity": np.random.choice(["low", "moderate", "high"])
        })
    
    init_result = service.initialize_child_pipeline("demo_child", routine_entries, behavior_entries)
    print(f"Initialization: {init_result['status']}")
    print(f"Models fitted: {init_result.get('models_fitted', [])}")
    
    # Demo: Analyze today
    print("\n" + "-"*60)
    print("Demo: Analyzing today's entry...")
    
    result = service.analyze_daily_behaviour(
        child_id="demo_child",
        date=datetime.now().strftime("%Y-%m-%d"),
        sleep_start="22:00",
        sleep_end="06:00",  # Less sleep
        emotions=["anxious"],
        behaviour_intensity="moderate",
        behaviour_notes="Seemed a bit restless in the morning",
        language="en"
    )
    
    print(f"\nAnalysis Result:")
    print(f"  Anomaly Score: {result['anomaly_score']}")
    print(f"  Confidence: {result['confidence']}%")
    print(f"  Forecast: {result['forecast']}")
    print(f"  Explanation: {result['explanation']}")
    
    # Demo: Get summary
    print("\n" + "-"*60)
    print("Demo: Getting child summary...")
    
    summary = service.get_child_summary("demo_child")
    print(f"  Initialized: {summary['is_initialized']}")
    if summary.get('baseline'):
        print(f"  Baseline Sleep: {summary['baseline']['baseline_sleep']} hours")
        print(f"  Baseline Confidence: {summary['baseline']['confidence']:.0%}")
    
    print("\nPipeline Status:")
    status = service.get_pipeline_status()
    print(f"  Children initialized: {status['children_count']}")
    print(f"  Anomaly model: {status['config']['anomaly_model']}")
    
    print("\n" + "="*60)
    print("Demo complete!")
