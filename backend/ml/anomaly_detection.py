"""
AutismCare Anomaly Detection Engine
Detects behavioral anomalies using Isolation Forest and One-Class SVM
"""

import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
import logging

from config import (
    PipelineConfig, AnomalyConfig, AnomalyModelType, get_config
)
from baseline_engine import ChildBaseline, BaselineEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AnomalyResult:
    """Result of anomaly detection for a single observation"""
    child_id: str
    date: str
    anomaly_score: float  # 0-1, higher = more anomalous
    confidence: float  # 0-100%
    is_anomaly: bool
    
    # Feature-level contributions
    contributing_features: List[Dict[str, Any]]  # [{feature, z_score, contribution}]
    
    # Alert information
    alert_triggered: bool = False
    alert_reason: Optional[str] = None
    consecutive_anomaly_days: int = 0
    
    # Metadata
    model_used: str = "isolation_forest"
    baseline_comparison: Optional[Dict] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass  
class AnomalyAlert:
    """Alert triggered by persistent anomalies"""
    child_id: str
    alert_id: str
    alert_type: str  # "threshold_exceeded", "persistent_pattern"
    severity: str  # "low", "medium", "high"
    message: str
    
    anomaly_score: float
    confidence: float
    consecutive_days: int
    
    contributing_factors: List[str]
    recommended_action: str
    
    created_at: str
    
    def to_dict(self) -> Dict:
        return asdict(self)


class IsolationForestDetector:
    """
    Anomaly detection using Isolation Forest
    Good for detecting outliers in behavioral patterns
    """
    
    def __init__(self, config: AnomalyConfig = None):
        self.config = config or AnomalyConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_names: List[str] = []
    
    def fit(self, training_data: pd.DataFrame, feature_cols: List[str] = None):
        """
        Fit the Isolation Forest model on training data
        
        Args:
            training_data: Historical behavioral data
            feature_cols: Columns to use as features
        """
        if feature_cols is None:
            feature_cols = ["sleep_hours", "activity_level", 
                          "emotion_score", "behaviour_score"]
        
        self.feature_names = feature_cols
        
        # Prepare feature matrix
        X = training_data[feature_cols].values
        
        # Check for sufficient data
        if len(X) < 10:
            logger.warning("Insufficient data for Isolation Forest training")
            return
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Initialize and fit model
        self.model = IsolationForest(
            n_estimators=self.config.n_estimators,
            max_samples=self.config.max_samples,
            contamination=self.config.contamination,
            random_state=42
        )
        
        self.model.fit(X_scaled)
        self.is_fitted = True
        
        logger.info(f"Isolation Forest fitted on {len(X)} samples")
    
    def predict_anomaly_score(
        self, 
        observation: Dict[str, float]
    ) -> Tuple[float, float]:
        """
        Predict anomaly score for a single observation
        
        Returns:
            (anomaly_score, confidence)
            - anomaly_score: 0-1, higher = more anomalous
            - confidence: 0-100%
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")
        
        # Prepare feature vector
        X = np.array([[observation.get(f, 0.5) for f in self.feature_names]])
        X_scaled = self.scaler.transform(X)
        
        # Get decision function score (lower = more anomalous)
        decision_score = self.model.decision_function(X_scaled)[0]
        
        # Convert to 0-1 anomaly score
        # Isolation Forest decision_function: negative = anomaly
        # Typical range is roughly -0.5 to 0.5
        anomaly_score = 1 / (1 + np.exp(decision_score * 5))  # Sigmoid transformation
        anomaly_score = max(0, min(1, anomaly_score))
        
        # Calculate confidence based on model certainty
        confidence = min(100, abs(decision_score) * 150)
        
        return anomaly_score, confidence
    
    def predict_batch(
        self, 
        data: pd.DataFrame
    ) -> List[Tuple[float, float]]:
        """Predict anomaly scores for multiple observations"""
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")
        
        X = data[self.feature_names].values
        X_scaled = self.scaler.transform(X)
        
        decision_scores = self.model.decision_function(X_scaled)
        
        results = []
        for score in decision_scores:
            anomaly_score = 1 / (1 + np.exp(score * 5))
            anomaly_score = max(0, min(1, anomaly_score))
            confidence = min(100, abs(score) * 150)
            results.append((anomaly_score, confidence))
        
        return results


class OneClassSVMDetector:
    """
    Anomaly detection using One-Class SVM
    Learns a decision boundary around normal behavior
    """
    
    def __init__(self, config: AnomalyConfig = None):
        self.config = config or AnomalyConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_names: List[str] = []
    
    def fit(self, training_data: pd.DataFrame, feature_cols: List[str] = None):
        """Fit the One-Class SVM model"""
        if feature_cols is None:
            feature_cols = ["sleep_hours", "activity_level", 
                          "emotion_score", "behaviour_score"]
        
        self.feature_names = feature_cols
        
        X = training_data[feature_cols].values
        
        if len(X) < 10:
            logger.warning("Insufficient data for One-Class SVM training")
            return
        
        X_scaled = self.scaler.fit_transform(X)
        
        self.model = OneClassSVM(
            nu=self.config.nu,
            kernel=self.config.kernel,
            gamma=self.config.gamma
        )
        
        self.model.fit(X_scaled)
        self.is_fitted = True
        
        logger.info(f"One-Class SVM fitted on {len(X)} samples")
    
    def predict_anomaly_score(
        self, 
        observation: Dict[str, float]
    ) -> Tuple[float, float]:
        """Predict anomaly score for a single observation"""
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")
        
        X = np.array([[observation.get(f, 0.5) for f in self.feature_names]])
        X_scaled = self.scaler.transform(X)
        
        # Get decision function score
        decision_score = self.model.decision_function(X_scaled)[0]
        
        # Convert to 0-1 anomaly score
        anomaly_score = 1 / (1 + np.exp(decision_score * 3))
        anomaly_score = max(0, min(1, anomaly_score))
        
        confidence = min(100, abs(decision_score) * 100)
        
        return anomaly_score, confidence
    
    def predict_batch(
        self, 
        data: pd.DataFrame
    ) -> List[Tuple[float, float]]:
        """Predict anomaly scores for multiple observations"""
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")
        
        X = data[self.feature_names].values
        X_scaled = self.scaler.transform(X)
        
        decision_scores = self.model.decision_function(X_scaled)
        
        results = []
        for score in decision_scores:
            anomaly_score = 1 / (1 + np.exp(score * 3))
            anomaly_score = max(0, min(1, anomaly_score))
            confidence = min(100, abs(score) * 100)
            results.append((anomaly_score, confidence))
        
        return results


class AnomalyDetectionEngine:
    """
    Main anomaly detection engine
    Orchestrates detection, baseline comparison, and alerts
    """
    
    def __init__(self, config: PipelineConfig = None):
        self.config = config or get_config()
        self.anomaly_config = self.config.anomaly
        
        # Initialize detectors
        self.isolation_forest = IsolationForestDetector(self.anomaly_config)
        self.one_class_svm = OneClassSVMDetector(self.anomaly_config)
        
        # Active detector based on config
        self.active_model_type = self.anomaly_config.model_type
        
        # Baseline engine for comparison
        self.baseline_engine: Optional[BaselineEngine] = None
        
        # Track consecutive anomaly days per child
        self.anomaly_history: Dict[str, List[str]] = {}  # child_id -> [dates]
        
        # Feature columns
        self.feature_cols = ["sleep_hours", "activity_level", 
                           "emotion_score", "behaviour_score"]
    
    def set_baseline_engine(self, baseline_engine: BaselineEngine):
        """Set the baseline engine for comparison"""
        self.baseline_engine = baseline_engine
    
    def fit(self, training_data: pd.DataFrame, child_id: Optional[str] = None):
        """
        Fit the anomaly detection model
        
        Args:
            training_data: Historical data (can be for one child or all)
            child_id: If provided, filter data for specific child
        """
        if child_id:
            data = training_data[training_data["child_id"] == child_id]
        else:
            data = training_data
        
        if len(data) < 10:
            logger.warning(f"Insufficient data for training: {len(data)} samples")
            return
        
        # Fit both models
        self.isolation_forest.fit(data, self.feature_cols)
        self.one_class_svm.fit(data, self.feature_cols)
    
    def detect_anomaly(
        self,
        child_id: str,
        observation: Dict[str, float],
        date: str
    ) -> AnomalyResult:
        """
        Detect if an observation is anomalous
        
        Args:
            child_id: Child identifier
            observation: Daily feature vector
            date: Observation date
        
        Returns:
            AnomalyResult with score, confidence, and contributing features
        """
        # Select model based on config
        if self.active_model_type == AnomalyModelType.ISOLATION_FOREST:
            detector = self.isolation_forest
            model_name = "isolation_forest"
        else:
            detector = self.one_class_svm
            model_name = "one_class_svm"
        
        # Predict anomaly score
        try:
            anomaly_score, confidence = detector.predict_anomaly_score(observation)
        except ValueError:
            # Model not fitted - use baseline comparison only
            anomaly_score = 0.0
            confidence = 0.0
            model_name = "baseline_only"
        
        # Compare to baseline if available
        baseline_comparison = None
        contributing_features = []
        
        if self.baseline_engine:
            baseline = self.baseline_engine.get_baseline(child_id)
            if baseline and baseline.is_valid:
                z_scores = self.baseline_engine.compare_to_baseline(
                    child_id, observation
                )
                baseline_comparison = z_scores
                
                # Identify contributing features
                for feature, z_score in z_scores.items():
                    base_feature = feature.replace("_z", "")
                    abs_z = abs(z_score)
                    
                    if abs_z > 1.0:  # More than 1 std from baseline
                        contribution = min(1.0, abs_z / 3)  # Normalize
                        direction = "higher" if z_score > 0 else "lower"
                        
                        contributing_features.append({
                            "feature": base_feature,
                            "z_score": round(z_score, 2),
                            "contribution": round(contribution, 2),
                            "direction": direction
                        })
                
                # Sort by contribution
                contributing_features.sort(
                    key=lambda x: x["contribution"], reverse=True
                )
                
                # Blend baseline z-scores with model score
                if z_scores:
                    max_z = max(abs(z) for z in z_scores.values())
                    baseline_anomaly = min(1.0, max_z / 3)
                    anomaly_score = 0.6 * anomaly_score + 0.4 * baseline_anomaly
        
        # Determine if anomaly
        is_anomaly = anomaly_score > self.anomaly_config.threshold
        
        # Track consecutive anomaly days
        consecutive_days = self._update_anomaly_history(child_id, date, is_anomaly)
        
        # Check for alert
        alert_triggered = False
        alert_reason = None
        
        if is_anomaly:
            if consecutive_days >= self.anomaly_config.persistence_days:
                alert_triggered = True
                alert_reason = (
                    f"Observation pattern has been unusual for "
                    f"{consecutive_days} consecutive days"
                )
            elif anomaly_score > 0.8:
                alert_triggered = True
                alert_reason = "Significant deviation from typical patterns observed"
        
        return AnomalyResult(
            child_id=child_id,
            date=date,
            anomaly_score=round(anomaly_score, 3),
            confidence=round(confidence, 1),
            is_anomaly=is_anomaly,
            contributing_features=contributing_features[:5],  # Top 5
            alert_triggered=alert_triggered,
            alert_reason=alert_reason,
            consecutive_anomaly_days=consecutive_days,
            model_used=model_name,
            baseline_comparison=baseline_comparison
        )
    
    def _update_anomaly_history(
        self, 
        child_id: str, 
        date: str, 
        is_anomaly: bool
    ) -> int:
        """Update and return consecutive anomaly count"""
        if child_id not in self.anomaly_history:
            self.anomaly_history[child_id] = []
        
        history = self.anomaly_history[child_id]
        
        if is_anomaly:
            # Add date if not already present
            if date not in history:
                history.append(date)
            
            # Count consecutive days (simplified - assumes sorted dates)
            # In production, properly sort and check date gaps
            return len(history)
        else:
            # Reset history on non-anomaly
            self.anomaly_history[child_id] = []
            return 0
    
    def detect_batch(
        self,
        child_id: str,
        data: pd.DataFrame
    ) -> List[AnomalyResult]:
        """Detect anomalies for multiple observations"""
        results = []
        
        for _, row in data.iterrows():
            observation = row.to_dict()
            date = str(observation.get("date", ""))
            
            result = self.detect_anomaly(child_id, observation, date)
            results.append(result)
        
        return results
    
    def create_alert(self, anomaly_result: AnomalyResult) -> Optional[AnomalyAlert]:
        """Create an alert from an anomaly result if warranted"""
        if not anomaly_result.alert_triggered:
            return None
        
        # Determine severity
        if anomaly_result.anomaly_score >= 0.8:
            severity = "high"
        elif anomaly_result.anomaly_score >= 0.6:
            severity = "medium"
        else:
            severity = "low"
        
        # Determine alert type
        if anomaly_result.consecutive_anomaly_days >= self.anomaly_config.persistence_days:
            alert_type = "persistent_pattern"
        else:
            alert_type = "threshold_exceeded"
        
        # Extract contributing factors
        factors = [
            f"{cf['feature']}: {cf['direction']} than usual"
            for cf in anomaly_result.contributing_features[:3]
        ]
        
        # Generate message (probability-based language)
        message = self._generate_alert_message(anomaly_result, factors)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(severity, factors)
        
        return AnomalyAlert(
            child_id=anomaly_result.child_id,
            alert_id=f"alert_{anomaly_result.child_id}_{anomaly_result.date}",
            alert_type=alert_type,
            severity=severity,
            message=message,
            anomaly_score=anomaly_result.anomaly_score,
            confidence=anomaly_result.confidence,
            consecutive_days=anomaly_result.consecutive_anomaly_days,
            contributing_factors=factors,
            recommended_action=recommendation,
            created_at=datetime.now().isoformat()
        )
    
    def _generate_alert_message(
        self, 
        result: AnomalyResult, 
        factors: List[str]
    ) -> str:
        """Generate probability-based alert message"""
        score_pct = int(result.anomaly_score * 100)
        
        messages = []
        messages.append(
            f"Observation patterns on {result.date} show {score_pct}% likelihood "
            "of deviation from typical baseline."
        )
        
        if factors:
            messages.append(f"Primary contributing factors: {', '.join(factors)}.")
        
        if result.consecutive_anomaly_days > 1:
            messages.append(
                f"This pattern has persisted for approximately "
                f"{result.consecutive_anomaly_days} days."
            )
        
        return " ".join(messages)
    
    def _generate_recommendation(
        self, 
        severity: str, 
        factors: List[str]
    ) -> str:
        """Generate recommended action"""
        if severity == "high":
            return (
                "Consider reviewing recent routine changes and consulting with "
                "the child's support team to understand potential contributing factors."
            )
        elif severity == "medium":
            return (
                "Monitor patterns over the next few days. Note any environmental "
                "or routine changes that may be relevant."
            )
        else:
            return (
                "Continue regular observation. Pattern may normalize as routines stabilize."
            )
    
    def switch_model(self, model_type: AnomalyModelType):
        """Switch the active detection model"""
        self.active_model_type = model_type
        logger.info(f"Switched to {model_type.value} model")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the current model"""
        return {
            "active_model": self.active_model_type.value,
            "threshold": self.anomaly_config.threshold,
            "persistence_days": self.anomaly_config.persistence_days,
            "isolation_forest_fitted": self.isolation_forest.is_fitted,
            "one_class_svm_fitted": self.one_class_svm.is_fitted
        }


# Example usage
if __name__ == "__main__":
    np.random.seed(42)
    
    # Create sample training data
    data = []
    for day in range(30):
        data.append({
            "child_id": "child_1",
            "date": (datetime.now() - timedelta(days=30-day)).strftime("%Y-%m-%d"),
            "sleep_hours": np.random.normal(8, 0.5),
            "activity_level": np.random.uniform(0.4, 0.6),
            "emotion_score": np.random.uniform(0.5, 0.7),
            "behaviour_score": np.random.uniform(0.5, 0.7)
        })
    
    df = pd.DataFrame(data)
    
    # Create engine
    engine = AnomalyDetectionEngine()
    
    # Fit model
    engine.fit(df)
    
    print("Model Info:", engine.get_model_info())
    
    # Test normal observation
    normal_obs = {
        "sleep_hours": 8.0,
        "activity_level": 0.5,
        "emotion_score": 0.6,
        "behaviour_score": 0.6
    }
    
    result = engine.detect_anomaly("child_1", normal_obs, "2024-01-31")
    print(f"\nNormal Observation:")
    print(f"  Anomaly Score: {result.anomaly_score}")
    print(f"  Is Anomaly: {result.is_anomaly}")
    print(f"  Confidence: {result.confidence}%")
    
    # Test anomalous observation
    anomaly_obs = {
        "sleep_hours": 4.0,  # Very low sleep
        "activity_level": 0.9,  # Very high activity
        "emotion_score": 0.2,  # Low emotion
        "behaviour_score": 0.2  # Low behaviour score
    }
    
    result = engine.detect_anomaly("child_1", anomaly_obs, "2024-02-01")
    print(f"\nAnomalous Observation:")
    print(f"  Anomaly Score: {result.anomaly_score}")
    print(f"  Is Anomaly: {result.is_anomaly}")
    print(f"  Confidence: {result.confidence}%")
    print(f"  Contributing Features: {result.contributing_features}")
    
    if result.alert_triggered:
        alert = engine.create_alert(result)
        print(f"\nAlert Created:")
        print(f"  Severity: {alert.severity}")
        print(f"  Message: {alert.message}")
        print(f"  Recommendation: {alert.recommended_action}")
