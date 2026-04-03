<div align="center">
  <h1>🧠 AutismCare Behavioural Intelligence Pipeline</h1>
  <p><strong>Explainable, Ethics-First Machine Learning Services</strong></p>
  
  [![Python](https://img.shields.io/badge/Python-3.10+-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
  [![Scikit-Learn](https://img.shields.io/badge/scikit--learn-%23F7931E.svg?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logoColor=white)](https://fastapi.tiangolo.com/)

</div>

---

A comprehensive, explainable behavioural intelligence system for AutismCare. This module provides:

- **Personalized behavioural baselines** using unsupervised learning
- **Anomaly detection** with configurable models (Isolation Forest / One-Class SVM)
- **Routine-behaviour correlation analysis** with interpretable insights
- **Short-term forecasting** using ARIMA/Prophet
- **Explainable AI outputs** using SHAP and decision trees
- **Ethics enforcement** for non-diagnostic, probability-based language

## 🎯 Key Features

### ✅ Non-Diagnostic
All outputs use observational language, never diagnostic terms.

### ✅ Probability-Based
Results are expressed as likelihoods and confidence scores.

### ✅ Academic-Safe
Designed for research and observational purposes with proper disclaimers.

### ✅ Explainable
Every prediction comes with human-readable explanations.

---

## 📦 Installation

```bash
cd backend/ml
pip install -r requirements.txt
```

### Optional: Prophet Forecasting
```bash
pip install prophet
```

### Optional: SHAP Explainability
```bash
pip install shap
```

---

## 🚀 Quick Start

### 1. Basic Usage

```python
from ml_service import get_ml_service

# Get the ML service
service = get_ml_service()

# Initialize pipeline for a child (requires historical data)
init_result = service.initialize_child_pipeline(
    child_id="child_123",
    routine_entries=[...],  # Historical routine data
    behavior_entries=[...]   # Historical behavior data
)

# Analyze today's entry
result = service.analyze_daily_behaviour(
    child_id="child_123",
    date="2024-01-15",
    sleep_start="22:00",
    sleep_end="06:30",
    emotions=["calm", "anxious"],
    behaviour_intensity="moderate",
    behaviour_notes="Had a good morning but seemed nervous before therapy"
)

print(result)
# {
#     "anomaly_score": 0.42,
#     "confidence": 78,
#     "forecast": "possible stability",
#     "explanation": "Sleep patterns are within typical range..."
# }
```

### 2. Using the REST API

```bash
# Start the API server
cd backend/ml
python api_server.py
```

Access at: `http://localhost:8001`

API Documentation: `http://localhost:8001/docs`

---

## 📊 Pipeline Components

### 1. Data Preprocessing (`data_preprocessing.py`)

Handles:
- Voice-to-text conversion (placeholder for STT integration)
- Multilingual text processing (Hindi, Tamil, Telugu, Bengali, etc.)
- Feature encoding and normalization

```python
from data_preprocessing import DataPreprocessor, RawDailyInput

preprocessor = DataPreprocessor()

# Process raw input
raw = RawDailyInput(
    child_id="child_123",
    date="2024-01-15",
    sleep_start="21:00",
    sleep_end="07:00",
    emotions=["calm"],
    behaviour_intensity="low",
    language="hi"  # Hindi
)

vector = preprocessor.process_single_entry(raw)
```

### 2. Baseline Engine (`baseline_engine.py`)

Creates personalized baselines using:
- **Statistical Profiling**: Rolling mean and standard deviation
- **K-Means Clustering**: Population-level behavior groups

```python
from baseline_engine import BaselineEngine

engine = BaselineEngine()
baselines = engine.create_baselines_batch(historical_df)

baseline = engine.get_baseline("child_123")
print(f"Sleep baseline: {baseline.baseline_sleep} ± {baseline.baseline_sleep_std}")
```

### 3. Anomaly Detection (`anomaly_detection.py`)

Models:
- **Isolation Forest** (default): Good for general outlier detection
- **One-Class SVM**: Better for specific boundary learning

```python
from anomaly_detection import AnomalyDetectionEngine

engine = AnomalyDetectionEngine()
engine.fit(training_data)

result = engine.detect_anomaly(
    child_id="child_123",
    observation={"sleep_hours": 5.0, "activity_level": 0.8, ...},
    date="2024-01-15"
)

print(f"Anomaly: {result.is_anomaly}, Score: {result.anomaly_score}")
```

### 4. Correlation Analysis (`correlation_engine.py`)

Analyzes routine-behaviour relationships using:
- **Linear Regression**: Interpretable coefficients
- **Random Forest**: Feature importance ranking

```python
from correlation_engine import CorrelationEngine

engine = CorrelationEngine()
analysis = engine.analyze_correlations("child_123", child_df)

print(f"Top factor: {analysis.top_influencing_factor}")
# "sleep_hours (42.3%)"
```

### 5. Forecasting (`forecasting_engine.py`)

Short-term predictions using:
- **ARIMA** (default): Statistical time series model
- **Prophet** (optional): Handles seasonality and trends

```python
from forecasting_engine import ForecastEngine

engine = ForecastEngine()
forecast = engine.generate_forecast("child_123", historical_df)

print(f"Trend: {forecast.trend_description}")
print(f"Tomorrow: {forecast.forecast_1_day.predicted_value}")
```

### 6. Explainability (`explainability_engine.py`)

Generates human-readable explanations using:
- **SHAP values**: Local feature attributions
- **Decision Trees**: Interpretable rules
- **Rule-based**: Domain knowledge fallback

```python
from explainability_engine import ExplanationEngine

engine = ExplanationEngine()
explanation = engine.generate_explanation(
    child_id="child_123",
    observation={...},
    prediction_type="anomaly",
    prediction_value=0.72
)

print(explanation.primary_explanation)
# "This pattern deviation is primarily influenced by..."
```

---

## 🔌 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/initialize` | Initialize pipeline for a child |
| POST | `/analyze` | Analyze daily entry |
| GET | `/baseline/{child_id}` | Get child's baseline |
| GET | `/correlation/{child_id}` | Get correlation analysis |
| POST | `/forecast/{child_id}` | Generate forecast |
| GET | `/summary/{child_id}` | Get complete summary |

### Example: Analyze Daily Entry

```bash
curl -X POST "http://localhost:8001/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": "child_123",
    "date": "2024-01-15",
    "sleep_start": "22:00",
    "sleep_end": "06:30",
    "emotions": ["anxious"],
    "behaviour_intensity": "moderate"
  }'
```

Response:
```json
{
  "anomaly_score": 0.72,
  "confidence": 85,
  "forecast": "likely increase",
  "explanation": "Reduced sleep contributed most to this observation..."
}
```

---

## ⚙️ Configuration

Configure the pipeline via `config.py`:

```python
from config import PipelineConfig, AnomalyModelType

config = PipelineConfig()

# Switch anomaly model
config.anomaly.model_type = AnomalyModelType.ONE_CLASS_SVM
config.anomaly.threshold = 0.7

# Adjust forecast horizons
config.forecast.horizons = [1, 3, 7]

# Enable/disable SHAP
config.explainability.enable_shap = True
```

### Via API

```bash
curl -X PUT "http://localhost:8001/config" \
  -H "Content-Type: application/json" \
  -d '{"anomaly_model": "one_class_svm", "anomaly_threshold": 0.7}'
```

---

## 🗃️ Database Schema

Run migration `014_create_behavioural_intelligence.sql` to create:

| Table | Description |
|-------|-------------|
| `child_baselines` | Personalized baselines per child |
| `daily_analysis_results` | ML analysis outputs per day |
| `correlation_analyses` | Routine-behavior correlations |
| `ml_alerts` | Behavioral alerts |

---

## 🛡️ Ethics Enforcement

All outputs automatically enforce:

1. **No diagnostic language**: Terms like "diagnosis", "disorder", "symptoms" are blocked
2. **Probability-based language**: Uses "may", "might", "appears to" instead of definitive statements
3. **Required explanations**: Every prediction includes an explanation
4. **Visible confidence**: Confidence scores always displayed
5. **Academic disclaimer**: Included in all outputs

```python
from explainability_engine import EthicsEnforcer

enforcer = EthicsEnforcer()

# Validate output
is_valid, violations = enforcer.validate_output(text)

# Sanitize prohibited terms
clean_text = enforcer.sanitize_output(text)

# Add probability language
probabilistic_text = enforcer.add_probability_language(text)
```

---

## 📁 File Structure

```
backend/ml/
├── __init__.py              # Module exports
├── config.py                # Pipeline configuration
├── data_preprocessing.py    # Voice/text processing
├── baseline_engine.py       # Unsupervised baselines
├── anomaly_detection.py     # Anomaly detection
├── correlation_engine.py    # Correlation analysis
├── forecasting_engine.py    # Time-series forecasting
├── explainability_engine.py # SHAP & explanations
├── intelligence_pipeline.py # Main orchestrator
├── api_server.py            # FastAPI REST API
├── ml_service.py            # Unified service layer
├── requirements.txt         # Dependencies
├── README.md               # This file
│
├── # Legacy components (backward compatible)
├── behavior_alert_analyzer.py
├── activity_suggestion_generator.py
├── appointment_optimizer.py
└── auto_intensity_alerts.py
```

---

## 🧪 Testing

Run the demo:

```bash
cd backend/ml
python ml_service.py
```

Run individual components:

```bash
python baseline_engine.py
python anomaly_detection.py
python correlation_engine.py
python forecasting_engine.py
python explainability_engine.py
```

---

## 🔄 Migration from v1.0

The new v2.0 service is **fully backward compatible**. Existing code using:

```python
from ml_service import get_ml_service
service = get_ml_service()

# These still work!
service.analyze_alert_priority(...)
service.generate_activity_suggestions(...)
service.find_optimal_appointments(...)
```

New methods are available alongside:

```python
service.initialize_child_pipeline(...)
service.analyze_daily_behaviour(...)
service.get_child_baseline(...)
service.generate_forecast(...)
```

---

## 📄 License

Academic use only. Not for clinical or diagnostic purposes.

---

## 🤝 Contributing

When contributing:
1. Maintain ethics enforcement in all outputs
2. Use probability-based language
3. Include explanations for all predictions
4. Add tests for new components
