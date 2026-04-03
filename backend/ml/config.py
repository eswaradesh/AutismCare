"""
AutismCare Behavioural Intelligence Configuration
Configurable settings for all ML pipeline components
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class AnomalyModelType(Enum):
    """Supported anomaly detection models"""
    ISOLATION_FOREST = "isolation_forest"
    ONE_CLASS_SVM = "one_class_svm"


class ForecastModelType(Enum):
    """Supported forecasting models"""
    ARIMA = "arima"
    PROPHET = "prophet"


class ClusteringMethod(Enum):
    """Supported baseline clustering methods"""
    KMEANS = "kmeans"
    STATISTICAL = "statistical"


@dataclass
class AnomalyConfig:
    """Configuration for anomaly detection"""
    model_type: AnomalyModelType = AnomalyModelType.ISOLATION_FOREST
    contamination: float = 0.1  # Expected proportion of anomalies
    threshold: float = 0.6  # Anomaly score threshold for alerts
    persistence_days: int = 2  # Days anomaly must persist for alert
    
    # Isolation Forest specific
    n_estimators: int = 100
    max_samples: str = "auto"
    
    # One-Class SVM specific
    nu: float = 0.1
    kernel: str = "rbf"
    gamma: str = "scale"


@dataclass
class BaselineConfig:
    """Configuration for personalized baseline creation"""
    method: ClusteringMethod = ClusteringMethod.STATISTICAL
    rolling_window_days: int = 14  # Days for rolling statistics
    min_data_points: int = 7  # Minimum entries before creating baseline
    
    # K-Means specific
    n_clusters: int = 3
    max_iterations: int = 300
    
    # Statistical profiling
    std_threshold: float = 2.0  # Standard deviations for abnormal


@dataclass
class ForecastConfig:
    """Configuration for time-series forecasting"""
    model_type: ForecastModelType = ForecastModelType.ARIMA
    horizons: List[int] = field(default_factory=lambda: [1, 3, 7])  # Days to forecast
    
    # ARIMA specific
    arima_order: tuple = (1, 1, 1)  # (p, d, q) parameters
    seasonal_order: tuple = (0, 0, 0, 0)  # Seasonal parameters
    
    # Prophet specific
    changepoint_prior_scale: float = 0.05
    seasonality_mode: str = "additive"


@dataclass
class CorrelationConfig:
    """Configuration for routine-behavior correlation analysis"""
    min_samples: int = 14  # Minimum samples for correlation
    feature_importance_method: str = "permutation"  # or "coefficients"
    use_random_forest: bool = True
    n_estimators_rf: int = 100
    top_n_features: int = 5


@dataclass
class ExplainabilityConfig:
    """Configuration for explainable AI outputs"""
    enable_shap: bool = True
    max_shap_samples: int = 100
    enable_decision_tree: bool = True
    decision_tree_max_depth: int = 5
    confidence_threshold: float = 0.7  # Minimum confidence for explanations


@dataclass
class EthicsConfig:
    """Ethics enforcement configuration"""
    # Prohibited language patterns
    prohibited_terms: List[str] = field(default_factory=lambda: [
        "diagnose", "diagnosis", "disorder", "disease", "condition",
        "autism", "autistic", "abnormal", "sick", "ill", "patient",
        "symptoms", "syndrome", "treatment", "cure", "therapy prescription"
    ])
    
    # Required language patterns
    probability_language: bool = True  # Enforce probability-based language
    explainability_required: bool = True  # All outputs must include explanations
    confidence_visible: bool = True  # Confidence scores always shown
    
    # Output prefixes for academic safety
    academic_disclaimer: str = (
        "This analysis is for observational insights only and does not "
        "constitute medical advice, diagnosis, or treatment recommendations. "
        "Consult qualified professionals for clinical decisions."
    )


@dataclass
class PipelineConfig:
    """Master configuration for the entire pipeline"""
    anomaly: AnomalyConfig = field(default_factory=AnomalyConfig)
    baseline: BaselineConfig = field(default_factory=BaselineConfig)
    forecast: ForecastConfig = field(default_factory=ForecastConfig)
    correlation: CorrelationConfig = field(default_factory=CorrelationConfig)
    explainability: ExplainabilityConfig = field(default_factory=ExplainabilityConfig)
    ethics: EthicsConfig = field(default_factory=EthicsConfig)
    
    # Global settings
    enable_voice_input: bool = True
    enable_multilingual: bool = True
    supported_languages: List[str] = field(default_factory=lambda: [
        "en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa"
    ])
    
    # Feature columns for ML
    feature_columns: List[str] = field(default_factory=lambda: [
        "sleep_hours", "activity_level", "emotion_score", 
        "behaviour_score", "medication_flag"
    ])


# Default configuration instance
DEFAULT_CONFIG = PipelineConfig()


def get_config() -> PipelineConfig:
    """Get the default pipeline configuration"""
    return DEFAULT_CONFIG
