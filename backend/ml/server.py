"""
FastAPI server for AutismCare ML Service
Provides REST API endpoints for all ML models
"""

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional, Any
from ml_service import get_ml_service

app = FastAPI(
    title="AutismCare ML Service",
    description="Machine learning models for autism care support",
    version="1.0.0"
)

# Add CORS middleware
CORS_ORIGINS = os.getenv("ML_CORS_ORIGINS", "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML service
ml_service = get_ml_service()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "AutismCare ML Service is running", "version": "1.0.0"}

@app.post("/api/ml/analyze-alert")
async def analyze_alert(alert_data: Dict[str, Any]):
    """
    Analyze alert priority and severity

    Expected JSON:
    {
        "alert": {...},
        "recent_alerts": [...],
        "baseline_intensity": 0.3
    }
    """
    try:
        alert = alert_data.get("alert")
        recent_alerts = alert_data.get("recent_alerts", [])
        baseline_intensity = alert_data.get("baseline_intensity", 0.3)

        if not alert:
            raise HTTPException(status_code=400, detail="Missing required field: alert")

        result = ml_service.analyze_alert_priority(
            alert,
            recent_alerts,
            baseline_intensity
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/batch-analyze-alerts")
async def batch_analyze_alerts(alerts_data: Dict[str, Any]):
    """
    Analyze multiple alerts and rank by priority

    Expected JSON:
    {
        "alerts": [...],
        "baseline_intensity": 0.3
    }
    """
    try:
        alerts = alerts_data.get("alerts")
        baseline_intensity = alerts_data.get("baseline_intensity", 0.3)

        if not alerts:
            raise HTTPException(status_code=400, detail="Missing required field: alerts")

        result = ml_service.batch_analyze_alerts(
            alerts,
            baseline_intensity
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/activity-suggestions")
async def get_activity_suggestions(suggestion_data: Dict[str, Any]):
    """
    Generate personalized activity suggestions

    Expected JSON:
    {
        "behavior_entries": [...],
        "routine_entries": [...],
        "child_profile": {...},
        "therapist_notes": [...],
        "top_n": 5
    }
    """
    try:
        behavior_entries = suggestion_data.get("behavior_entries")
        routine_entries = suggestion_data.get("routine_entries")

        if not behavior_entries:
            raise HTTPException(status_code=400, detail="Missing required field: behavior_entries")
        if not routine_entries:
            raise HTTPException(status_code=400, detail="Missing required field: routine_entries")

        result = ml_service.generate_activity_suggestions(
            behavior_entries,
            routine_entries,
            suggestion_data.get("child_profile"),
            suggestion_data.get("therapist_notes"),
            suggestion_data.get("top_n", 5)
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/optimal-appointments")
async def find_optimal_appointments(appointment_data: Dict[str, Any]):
    """
    Find optimal appointment slots

    Expected JSON:
    {
        "available_slots": [...],
        "parent_preference": {...},
        "behavior_entries": [...],
        "desired_date_str": "2025-02-15"
    }
    """
    try:
        available_slots = appointment_data.get("available_slots")
        parent_preference = appointment_data.get("parent_preference")
        behavior_entries = appointment_data.get("behavior_entries")
        desired_date_str = appointment_data.get("desired_date_str")

        if not available_slots:
            raise HTTPException(status_code=400, detail="Missing required field: available_slots")
        if not parent_preference:
            raise HTTPException(status_code=400, detail="Missing required field: parent_preference")
        if not behavior_entries:
            raise HTTPException(status_code=400, detail="Missing required field: behavior_entries")
        if not desired_date_str:
            raise HTTPException(status_code=400, detail="Missing required field: desired_date_str")

        result = ml_service.find_optimal_appointments(
            available_slots,
            parent_preference,
            behavior_entries,
            desired_date_str
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/check-auto-alert")
async def check_auto_alert(alert_data: Dict[str, Any]):
    """
    Check if new behavior entry triggers automatic alert

    Expected JSON:
    {
        "new_entry": {...},
        "child_id": "child_123",
        "parent_id": "parent_456",
        "therapist_ids": ["t1", "t2"],
        "recent_entries": [...]
    }
    """
    try:
        new_entry = alert_data.get("new_entry")
        child_id = alert_data.get("child_id")
        parent_id = alert_data.get("parent_id")
        therapist_ids = alert_data.get("therapist_ids", [])
        recent_entries = alert_data.get("recent_entries")

        if not new_entry:
            raise HTTPException(status_code=400, detail="Missing required field: new_entry")
        if not child_id:
            raise HTTPException(status_code=400, detail="Missing required field: child_id")
        if not parent_id:
            raise HTTPException(status_code=400, detail="Missing required field: parent_id")

        result = ml_service.check_auto_intensity_alert(
            new_entry,
            child_id,
            parent_id,
            therapist_ids,
            recent_entries
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting AutismCare ML Service on http://localhost:8000")
    print("API documentation available at http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
