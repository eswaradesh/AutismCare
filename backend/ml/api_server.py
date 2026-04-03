"""
AutismCare Behavioural Intelligence API Server
FastAPI server exposing the ML pipeline as REST endpoints
"""

import os

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
import logging
import uvicorn

from intelligence_pipeline import get_pipeline, BehaviouralIntelligencePipeline
from data_preprocessing import RawDailyInput
from config import get_config, AnomalyModelType, ForecastModelType

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AutismCare Behavioural Intelligence API",
    description="""
    Explainable Behavioural Intelligence Pipeline for AutismCare.
    
    Features:
    - Personalized behavioral baselines (unsupervised learning)
    - Anomaly detection with confidence scores
    - Routine-behavior correlation analysis
    - Short-term behavior forecasting
    - Explainable AI outputs
    
    **Ethics Compliance:**
    - Non-diagnostic outputs
    - Probability-based language
    - Explainability always enabled
    - Confidence scores visible
    
    Academic-safe for research and observational purposes.
    """,
    version="1.0.0"
)

# CORS middleware
CORS_ORIGINS = os.getenv("ML_CORS_ORIGINS", "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Pydantic Models ====================

class ActivityInput(BaseModel):
    type: str
    duration: int  # minutes
    notes: Optional[str] = None


class MealInput(BaseModel):
    time: str
    type: str
    notes: Optional[str] = None


class DailyInputRequest(BaseModel):
    """Request model for daily input submission"""
    child_id: str = Field(..., description="Child identifier")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    sleep_start: Optional[str] = Field(None, description="Sleep start time HH:MM")
    sleep_end: Optional[str] = Field(None, description="Wake up time HH:MM")
    meals: Optional[List[MealInput]] = None
    activities: Optional[List[ActivityInput]] = None
    emotions: Optional[List[str]] = Field(None, description="List of observed emotions")
    behaviour_notes: Optional[str] = Field(None, description="Free-text observations")
    behaviour_intensity: Optional[str] = Field("moderate", description="low/moderate/high")
    medication_taken: Optional[bool] = None
    voice_note_text: Optional[str] = Field(None, description="Transcribed voice note")
    language: str = Field("en", description="Language code")


class AnalysisResponse(BaseModel):
    """Standard analysis response matching specification"""
    anomaly_score: float = Field(..., ge=0, le=1, description="Anomaly score 0-1")
    confidence: int = Field(..., ge=0, le=100, description="Confidence percentage")
    forecast: str = Field(..., description="likely_increase/possible_stability/may_reduce")
    explanation: str = Field(..., description="Human-readable explanation")
    contributing_factors: Optional[List[str]] = None
    alert: Optional[Dict[str, Any]] = None


class InitializationRequest(BaseModel):
    """Request to initialize pipeline for a child"""
    child_id: str
    historical_data: List[Dict[str, Any]] = Field(
        ..., 
        description="List of historical daily records"
    )


class InitializationResponse(BaseModel):
    """Response from pipeline initialization"""
    child_id: str
    status: str
    message: Optional[str] = None
    baseline: Optional[Dict[str, Any]] = None
    models_fitted: List[str] = []


class BaselineResponse(BaseModel):
    """Response containing child baseline"""
    child_id: str
    baseline_sleep: float
    baseline_activity: float
    baseline_emotion: float
    baseline_behaviour: float
    confidence: float
    is_valid: bool
    data_points_used: int


class CorrelationResponse(BaseModel):
    """Response containing correlation analysis"""
    child_id: str
    model_type: str
    r_squared: float
    top_influencing_factor: str
    summary_explanation: str
    feature_importances: List[Dict[str, Any]]


class ForecastResponse(BaseModel):
    """Response containing behavior forecast"""
    child_id: str
    trend: str
    trend_confidence: float
    forecast_1_day: Dict[str, Any]
    forecast_3_day: Dict[str, Any]
    forecast_7_day: Dict[str, Any]
    interpretation: str


class ConfigUpdateRequest(BaseModel):
    """Request to update pipeline configuration"""
    anomaly_model: Optional[str] = Field(None, description="isolation_forest or one_class_svm")
    forecast_model: Optional[str] = Field(None, description="arima or prophet")
    anomaly_threshold: Optional[float] = Field(None, ge=0, le=1)
    persistence_days: Optional[int] = Field(None, ge=1, le=30)


# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """API health check"""
    return {
        "service": "AutismCare Behavioural Intelligence API",
        "status": "running",
        "version": "1.0.0",
        "disclaimer": "Non-diagnostic, probability-based, academic-safe"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    pipeline = get_pipeline()
    return {
        "status": "healthy",
        "pipeline_initialized": pipeline.is_initialized,
        "children_count": len(pipeline.children_initialized),
        "config": {
            "anomaly_model": pipeline.anomaly_engine.active_model_type.value,
            "enable_shap": pipeline.config.explainability.enable_shap,
            "enable_multilingual": pipeline.config.enable_multilingual
        }
    }


@app.post("/initialize", response_model=InitializationResponse)
async def initialize_child(request: InitializationRequest):
    """
    Initialize the pipeline for a child with historical data
    
    Requires at least 7 days of historical data for baseline creation.
    More data (14+ days) provides better correlation and forecast accuracy.
    """
    import pandas as pd
    
    try:
        pipeline = get_pipeline()
        
        # Convert to DataFrame
        df = pd.DataFrame(request.historical_data)
        
        # Ensure required columns
        required_cols = ["date", "sleep_hours", "activity_level", 
                        "emotion_score", "behaviour_score"]
        
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing}"
            )
        
        # Initialize
        result = pipeline.initialize_child(request.child_id, df)
        
        return InitializationResponse(**result)
        
    except Exception as e:
        logger.error(f"Initialization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RawInitializationRequest(BaseModel):
    """Request model for initialization with raw DB entries"""
    child_id: str
    routine_entries: List[Dict[str, Any]]
    behavior_entries: List[Dict[str, Any]]


@app.post("/initialize_raw", response_model=InitializationResponse)
async def initialize_raw(request: RawInitializationRequest):
    """
    Initialize pipeline using raw database entries
    """
    from ml_service import get_ml_service
    
    try:
        service = get_ml_service()
        result = service.initialize_child_pipeline(
            request.child_id,
            request.routine_entries,
            request.behavior_entries
        )
        return InitializationResponse(**result)
    except Exception as e:
        logger.error(f"Raw initialization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_daily_entry(request: DailyInputRequest):
    """
    Analyze a single daily entry
    
    Returns anomaly score, confidence, forecast, and explanation.
    
    Example response:
    ```json
    {
        "anomaly_score": 0.72,
        "confidence": 85,
        "forecast": "likely increase",
        "explanation": "Reduced sleep contributed most"
    }
    ```
    """
    try:
        pipeline = get_pipeline()
        
        # Convert request to RawDailyInput
        raw_input = RawDailyInput(
            child_id=request.child_id,
            date=request.date,
            sleep_start=request.sleep_start,
            sleep_end=request.sleep_end,
            meals=[m.dict() for m in request.meals] if request.meals else None,
            activities=[a.dict() for a in request.activities] if request.activities else None,
            emotions=request.emotions,
            behaviour_notes=request.behaviour_notes,
            behaviour_intensity=request.behaviour_intensity,
            medication_taken=request.medication_taken,
            voice_note_text=request.voice_note_text,
            language=request.language
        )
        
        # Process through pipeline
        result = pipeline.process_daily_entry(raw_input)
        
        return AnalysisResponse(
            anomaly_score=round(result.anomaly_score, 2),
            confidence=int(result.confidence),
            forecast=result.forecast.replace("_", " "),
            explanation=result.explanation,
            contributing_factors=result.contributing_factors,
            alert=result.alert
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/baseline/{child_id}", response_model=BaselineResponse)
async def get_baseline(child_id: str):
    """
    Get the personalized baseline for a child
    
    Returns statistical baseline including mean and std for each feature.
    """
    try:
        pipeline = get_pipeline()
        baseline = pipeline.baseline_engine.get_baseline(child_id)
        
        if not baseline:
            raise HTTPException(
                status_code=404,
                detail=f"No baseline found for child: {child_id}"
            )
        
        return BaselineResponse(
            child_id=baseline.child_id,
            baseline_sleep=baseline.baseline_sleep,
            baseline_activity=baseline.baseline_activity,
            baseline_emotion=baseline.baseline_emotion,
            baseline_behaviour=baseline.baseline_behaviour,
            confidence=baseline.confidence,
            is_valid=baseline.is_valid,
            data_points_used=baseline.data_points_used
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Baseline retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/correlation/{child_id}", response_model=CorrelationResponse)
async def get_correlation_analysis(child_id: str):
    """
    Get routine-behavior correlation analysis for a child
    
    Returns feature importances showing which factors most influence behavior.
    """
    try:
        pipeline = get_pipeline()
        analysis = pipeline.correlation_engine.analyses.get(child_id)
        
        if not analysis:
            raise HTTPException(
                status_code=404,
                detail=f"No correlation analysis found for child: {child_id}"
            )
        
        return CorrelationResponse(
            child_id=analysis.child_id,
            model_type=analysis.model_type,
            r_squared=analysis.r_squared,
            top_influencing_factor=analysis.top_influencing_factor,
            summary_explanation=analysis.summary_explanation,
            feature_importances=[
                {
                    "feature": fi.feature_name,
                    "importance_percentage": fi.importance_percentage,
                    "direction": fi.direction,
                    "interpretation": fi.interpretation
                }
                for fi in analysis.feature_importances
            ]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Correlation retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ForecastRequest(BaseModel):
    historical_data: List[Dict[str, Any]]


@app.post("/forecast/{child_id}", response_model=ForecastResponse)
async def generate_forecast(
    child_id: str,
    request: ForecastRequest
):
    """
    Generate short-term behavior forecast

    Requires recent historical data (at least 14 days recommended).
    Returns forecasts for 1, 3, and 7 days ahead.
    """
    import pandas as pd

    try:
        pipeline = get_pipeline()

        historical_data = request.historical_data
        df = pd.DataFrame(historical_data)
        
        if "date" not in df.columns or "behaviour_score" not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="Data must contain 'date' and 'behaviour_score' columns"
            )
        
        forecast = pipeline.forecast_engine.generate_forecast(child_id, df)
        
        return ForecastResponse(
            child_id=forecast.child_id,
            trend=forecast.trend_description.replace("_", " "),
            trend_confidence=forecast.trend_confidence,
            forecast_1_day={
                "date": forecast.forecast_1_day.date,
                "predicted": forecast.forecast_1_day.predicted_value,
                "lower": forecast.forecast_1_day.lower_bound,
                "upper": forecast.forecast_1_day.upper_bound,
                "confidence": forecast.forecast_1_day.confidence
            },
            forecast_3_day={
                "date": forecast.forecast_3_day.date,
                "predicted": forecast.forecast_3_day.predicted_value,
                "lower": forecast.forecast_3_day.lower_bound,
                "upper": forecast.forecast_3_day.upper_bound,
                "confidence": forecast.forecast_3_day.confidence
            },
            forecast_7_day={
                "date": forecast.forecast_7_day.date,
                "predicted": forecast.forecast_7_day.predicted_value,
                "lower": forecast.forecast_7_day.lower_bound,
                "upper": forecast.forecast_7_day.upper_bound,
                "confidence": forecast.forecast_7_day.confidence
            },
            interpretation=forecast.interpretation
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/summary/{child_id}")
async def get_child_summary(child_id: str):
    """
    Get summary of child's analysis state
    
    Returns baseline info, correlation summary, and initialization status.
    """
    try:
        pipeline = get_pipeline()
        return pipeline.get_child_summary(child_id)
    except Exception as e:
        logger.error(f"Summary retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/config")
async def update_config(request: ConfigUpdateRequest):
    """
    Update pipeline configuration
    
    Allows switching between anomaly detection and forecasting models.
    """
    try:
        pipeline = get_pipeline()
        
        updates = {}
        
        if request.anomaly_model:
            model_type = AnomalyModelType(request.anomaly_model)
            pipeline.anomaly_engine.switch_model(model_type)
            updates["anomaly_model"] = request.anomaly_model
        
        if request.forecast_model:
            model_type = ForecastModelType(request.forecast_model)
            pipeline.forecast_engine.switch_model(model_type)
            updates["forecast_model"] = request.forecast_model
        
        if request.anomaly_threshold is not None:
            pipeline.anomaly_engine.anomaly_config.threshold = request.anomaly_threshold
            updates["anomaly_threshold"] = request.anomaly_threshold
        
        if request.persistence_days is not None:
            pipeline.anomaly_engine.anomaly_config.persistence_days = request.persistence_days
            updates["persistence_days"] = request.persistence_days
        
        return {
            "status": "updated",
            "updates": updates
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Config update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models")
async def get_model_info():
    """
    Get information about current models and their configurations
    """
    pipeline = get_pipeline()
    
    return {
        "anomaly_detection": pipeline.anomaly_engine.get_model_info(),
        "forecasting": pipeline.forecast_engine.get_model_info(),
        "explainability": {
            "shap_enabled": pipeline.config.explainability.enable_shap,
            "decision_tree_enabled": pipeline.config.explainability.enable_decision_tree
        },
        "ethics": {
            "probability_language": pipeline.config.ethics.probability_language,
            "explainability_required": pipeline.config.ethics.explainability_required,
            "confidence_visible": pipeline.config.ethics.confidence_visible
        }
    }


@app.get("/ethics/disclaimer")
async def get_ethics_disclaimer():
    """
    Get the ethics disclaimer for all outputs
    """
    config = get_config()
    return {
        "disclaimer": config.ethics.academic_disclaimer,
        "prohibited_terms": config.ethics.prohibited_terms[:5],  # Sample
        "rules": {
            "non_diagnostic": True,
            "probability_based": True,
            "explainability_always_on": True,
            "confidence_always_visible": True
        }
    }


# ==================== Run Server ====================

def start_server(host: str = "0.0.0.0", port: int = 8001):
    """Start the API server"""
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    logger.info("Starting AutismCare Behavioural Intelligence API...")
    start_server()
