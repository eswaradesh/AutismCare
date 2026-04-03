"""
AutismCare ML Module
Behavioural Intelligence Pipeline Components

This module provides:
- Data preprocessing with multilingual and voice support
- Personalized behavioral baselines (unsupervised learning)
- Anomaly detection (Isolation Forest / One-Class SVM)
- Routine-behavior correlation analysis
- Short-term behavior forecasting (ARIMA / Prophet)
- Explainable AI outputs (SHAP / Decision Trees)
- Ethics enforcement for non-diagnostic outputs
"""

# Configuration
from config import (
    PipelineConfig,
    AnomalyConfig,
    BaselineConfig,
    ForecastConfig,
    CorrelationConfig,
    ExplainabilityConfig,
    EthicsConfig,
    AnomalyModelType,
    ForecastModelType,
    ClusteringMethod,
    get_config
)

# Data preprocessing
from data_preprocessing import (
    DataPreprocessor,
    RawDailyInput,
    ProcessedDailyVector,
    VoiceToTextProcessor,
    MultilingualTextProcessor,
    FeatureEncoder
)

# Baseline engine
from baseline_engine import (
    BaselineEngine,
    ChildBaseline,
    ClusterProfile,
    StatisticalProfiler,
    KMeansProfiler
)

# Anomaly detection
from anomaly_detection import (
    AnomalyDetectionEngine,
    AnomalyResult,
    AnomalyAlert,
    IsolationForestDetector,
    OneClassSVMDetector
)

# Correlation analysis
from correlation_engine import (
    CorrelationEngine,
    CorrelationAnalysis,
    FeatureImportance,
    CorrelationInsight
)

# Forecasting
from forecasting_engine import (
    ForecastEngine,
    BehaviourForecast,
    ForecastPoint,
    TrendAnalysis
)

# Explainability
from explainability_engine import (
    ExplanationEngine,
    ExplanationOutput,
    FeatureContribution,
    EthicsEnforcer
)

# Main pipeline
from intelligence_pipeline import (
    BehaviouralIntelligencePipeline,
    DailyAnalysisResult,
    get_pipeline
)

# Legacy components (for backward compatibility)
from behavior_alert_analyzer import BehaviorAlertAnalyzer, BehaviorAlert
from activity_suggestion_generator import ActivitySuggestionGenerator
from appointment_optimizer import AppointmentSchedulingOptimizer
from auto_intensity_alerts import AutoIntensityAlertDetector


__all__ = [
    # Config
    'PipelineConfig',
    'AnomalyConfig',
    'BaselineConfig',
    'ForecastConfig',
    'CorrelationConfig',
    'ExplainabilityConfig',
    'EthicsConfig',
    'AnomalyModelType',
    'ForecastModelType',
    'ClusteringMethod',
    'get_config',
    
    # Preprocessing
    'DataPreprocessor',
    'RawDailyInput',
    'ProcessedDailyVector',
    
    # Baseline
    'BaselineEngine',
    'ChildBaseline',
    
    # Anomaly
    'AnomalyDetectionEngine',
    'AnomalyResult',
    'AnomalyAlert',
    
    # Correlation
    'CorrelationEngine',
    'CorrelationAnalysis',
    'FeatureImportance',
    
    # Forecast
    'ForecastEngine',
    'BehaviourForecast',
    
    # Explainability
    'ExplanationEngine',
    'ExplanationOutput',
    'EthicsEnforcer',
    
    # Pipeline
    'BehaviouralIntelligencePipeline',
    'DailyAnalysisResult',
    'get_pipeline',
    
    # Legacy
    'BehaviorAlertAnalyzer',
    'ActivitySuggestionGenerator',
    'AppointmentSchedulingOptimizer',
    'AutoIntensityAlertDetector'
]

__version__ = '2.0.0'
