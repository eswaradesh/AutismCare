from datetime import datetime, timedelta
import os
from pathlib import Path
import shutil
import uuid

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, hash_password, verify_password
from .database import Base, engine, get_db, SessionLocal
from .models import (
    BehaviorAlert,
    BehaviorAlertReview,
    BehaviorIntensityAlert,
    BehaviorEntry,
    ChildProfile,
    DailySummary,
    Medication,
    ParentTherapistRelationship,
    RoutineEntry,
    SharedReport,
    TherapistActivitySuggestion,
    TherapistNote,
    TherapistProfile,
    User,
)
from .schemas import (
    ParentTherapistConnectRequest,
    ParentTherapistRelationshipResponse,
    ParentTherapistRevokeRequest,
    PublicTherapistDirectoryItemResponse,
    TherapistAlertAcknowledgeRequest,
    TherapistAlertReviewResponse,
    TherapistAuthResponse,
    TherapistAuthUserResponse,
    TherapistBehaviorAlertResponse,
    TherapistBehaviorEntryResponse,
    TherapistChildEntriesResponse,
    TherapistChildProfileResponse,
    TherapistChildSummary,
    TherapistIntensityAlertResponse,
    TherapistLoginRequest,
    TherapistNoteCreate,
    TherapistNoteResponse,
    TherapistProfileBasicResponse,
    TherapistProfileStatusResponse,
    TherapistRegistrationPayload,
    TherapistRoutineEntryResponse,
    TherapistSuggestionCreate,
    TherapistSuggestionResponse,
    ChildProfileSaveRequest,
)

app = FastAPI(title="AuCare PostgreSQL API", version="0.1.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "BACKEND_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://127.0.0.1:8082",
    ).split(",")
    if origin.strip()
]
allowed_origin_regex = os.getenv(
    "BACKEND_CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    # Migrate: add missing columns to therapist_profiles if they don't exist
    with engine.connect() as conn:
        import sqlalchemy
        inspector = sqlalchemy.inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("therapist_profiles")}
        if "verified_at" not in existing:
            conn.execute(sqlalchemy.text("ALTER TABLE therapist_profiles ADD COLUMN verified_at DATETIME"))
        if "verified_by" not in existing:
            conn.execute(sqlalchemy.text("ALTER TABLE therapist_profiles ADD COLUMN verified_by VARCHAR"))
        if "rejection_reason" not in existing:
            conn.execute(sqlalchemy.text("ALTER TABLE therapist_profiles ADD COLUMN rejection_reason TEXT"))
        conn.commit()
    # Auto-verify any pending therapist profiles (migration for existing data)
    db = SessionLocal()
    try:
        pending = db.query(TherapistProfile).filter(TherapistProfile.verification_status == "pending").all()
        for profile in pending:
            profile.verification_status = "verified"
            profile.verified_at = datetime.utcnow()
        if pending:
            db.commit()
            print(f"Auto-verified {len(pending)} pending therapist profile(s)")
    except Exception:
        db.rollback()
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/public/therapists/verified", response_model=list[PublicTherapistDirectoryItemResponse])
def list_verified_therapists(db: Session = Depends(get_db)):
    profiles = (
        db.query(TherapistProfile)
        .filter(TherapistProfile.verification_status == "verified")
        .order_by(TherapistProfile.full_name.asc())
        .all()
    )

    return [
        PublicTherapistDirectoryItemResponse(
            id=profile.id,
            user_id=profile.user_id,
            full_name=profile.full_name,
            qualification=profile.qualification,
            specialization=profile.specialization,
            clinic_name=profile.clinic_name,
            contact_email=profile.contact_email,
            verification_status=profile.verification_status,
        )
        for profile in profiles
    ]


@app.get("/parent-therapist/relationships", response_model=list[ParentTherapistRelationshipResponse])
def list_parent_therapist_relationships(
    child_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ParentTherapistRelationship).filter(ParentTherapistRelationship.parent_id == current_user.id)
    if child_id:
        query = query.filter(ParentTherapistRelationship.child_id == child_id)

    rels = query.order_by(ParentTherapistRelationship.created_at.desc()).all()
    return [
        ParentTherapistRelationshipResponse(
            id=rel.id,
            parent_id=rel.parent_id,
            therapist_id=rel.therapist_id,
            child_id=rel.child_id,
            status=rel.status,
            created_at=rel.created_at.isoformat() if rel.created_at else datetime.utcnow().isoformat(),
        )
        for rel in rels
    ]


@app.post("/parent-therapist/connect")
def connect_parent_to_therapist(
    payload: ParentTherapistConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    therapist = (
        db.query(TherapistProfile)
        .filter(
            TherapistProfile.user_id == payload.therapist_id,
            TherapistProfile.verification_status == "verified",
        )
        .first()
    )
    if not therapist:
        raise HTTPException(status_code=404, detail="Verified therapist not found")

    child = db.query(ChildProfile).filter(ChildProfile.id == payload.child_id).first()
    if not child:
        child = ChildProfile(
            id=payload.child_id,
            user_id=current_user.id,
            name=payload.child_name or "Child",
            age_years=0,
            age_months=0,
            communication_level="developing",
            sensory_preference="mixed",
        )
        db.add(child)

    relationship = (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.parent_id == current_user.id,
            ParentTherapistRelationship.therapist_id == payload.therapist_id,
            ParentTherapistRelationship.child_id == payload.child_id,
        )
        .first()
    )

    if not relationship:
        relationship = ParentTherapistRelationship(
            parent_id=current_user.id,
            therapist_id=payload.therapist_id,
            child_id=payload.child_id,
            status="accepted",
        )
        db.add(relationship)
    else:
        relationship.status = "accepted"

    db.commit()
    return {"ok": True, "relationship_id": relationship.id, "status": relationship.status}


@app.post("/parent-therapist/{relationship_id}/revoke")
def revoke_parent_therapist_relationship(
    relationship_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    relationship = (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.id == relationship_id,
            ParentTherapistRelationship.parent_id == current_user.id,
        )
        .first()
    )
    if not relationship:
        raise HTTPException(status_code=404, detail="Relationship not found")

    relationship.status = "revoked"
    db.commit()
    return {"ok": True}


def get_linked_relationship(db: Session, therapist_id: str, ref_id: str) -> ParentTherapistRelationship | None:
    return (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.therapist_id == therapist_id,
            ParentTherapistRelationship.status == "accepted",
            (ParentTherapistRelationship.id == ref_id) | (ParentTherapistRelationship.child_id == ref_id),
        )
        .first()
    )


@app.get("/therapist/children", response_model=list[TherapistChildSummary])
def get_therapist_children(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    relationships = (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.therapist_id == current_user.id,
            ParentTherapistRelationship.status == "accepted",
        )
        .all()
    )

    output: list[TherapistChildSummary] = []
    for rel in relationships:
        parent = db.query(User).filter(User.id == rel.parent_id).first()
        child = db.query(ChildProfile).filter(ChildProfile.id == rel.child_id).first() if rel.child_id else None

        routine_count = 0
        behavior_count = 0
        needs_attention = False

        if child:
            routine_count = (
                db.query(RoutineEntry)
                .filter(RoutineEntry.child_id == child.id)
                .count()
            )
            seven_days_ago = (datetime.utcnow() - timedelta(days=7)).date()
            behavior_count = (
                db.query(BehaviorEntry)
                .filter(
                    BehaviorEntry.child_id == child.id,
                    BehaviorEntry.is_sudden.is_(True),
                    BehaviorEntry.date >= seven_days_ago,
                )
                .count()
            )
            needs_attention = behavior_count > 0

        output.append(
            TherapistChildSummary(
                relationship_id=rel.id,
                child_id=(child.id if child else ""),
                child_name=(child.name if child else "Child"),
                parent_id=rel.parent_id,
                parent_name=(parent.full_name if parent and parent.full_name else "Parent"),
                status=rel.status,
                last_report_date=(
                    (rel.created_at.isoformat() if rel.created_at else None)
                ),
                routine_count=routine_count,
                behavior_count=behavior_count,
                needs_attention=needs_attention,
            )
        )

    return output


@app.get("/therapist/children/{ref_id}/profile", response_model=TherapistChildProfileResponse)
def get_therapist_child_profile(
    ref_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    rel = (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.therapist_id == current_user.id,
            ParentTherapistRelationship.status == "accepted",
            (ParentTherapistRelationship.id == ref_id) | (ParentTherapistRelationship.child_id == ref_id),
        )
        .first()
    )

    if not rel:
        raise HTTPException(status_code=404, detail="No linked child found")

    child = db.query(ChildProfile).filter(ChildProfile.id == rel.child_id).first() if rel.child_id else None

    if not child:
        child = (
            db.query(ChildProfile)
            .filter(ChildProfile.user_id == rel.parent_id)
            .order_by(ChildProfile.created_at.desc())
            .first()
        )

    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found")

    parent = db.query(User).filter(User.id == rel.parent_id).first()

    return TherapistChildProfileResponse(
        relationship_id=rel.id,
        child_id=child.id,
        child_name=child.name,
        age_years=child.age_years or 0,
        age_months=child.age_months or 0,
        communication_level=child.communication_level or "unknown",
        sensory_preference=child.sensory_preference or "unknown",
        parent_id=rel.parent_id,
        parent_name=parent.full_name if parent and parent.full_name else "Parent",
    )


@app.get("/therapist/children/{ref_id}/entries", response_model=TherapistChildEntriesResponse)
def get_therapist_child_entries(
    ref_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    rel = get_linked_relationship(db, current_user.id, ref_id)
    if not rel:
        raise HTTPException(status_code=404, detail="No linked child found")

    child_id = rel.child_id
    if not child_id:
        child = (
            db.query(ChildProfile)
            .filter(ChildProfile.user_id == rel.parent_id)
            .order_by(ChildProfile.created_at.desc())
            .first()
        )
        child_id = child.id if child else None

    if not child_id:
        return TherapistChildEntriesResponse(routines=[], behaviors=[])

    routines = (
        db.query(RoutineEntry)
        .filter(RoutineEntry.child_id == child_id)
        .order_by(RoutineEntry.created_at.desc())
        .all()
    )

    behaviors = (
        db.query(BehaviorEntry)
        .filter(BehaviorEntry.child_id == child_id)
        .order_by(BehaviorEntry.created_at.desc())
        .all()
    )

    return TherapistChildEntriesResponse(
        routines=[
            TherapistRoutineEntryResponse(
                id=r.id,
                child_id=r.child_id,
                date=r.date.isoformat(),
                type=r.type,
                notes=r.notes,
                created_at=r.created_at.isoformat(),
            )
            for r in routines
        ],
        behaviors=[
            TherapistBehaviorEntryResponse(
                id=b.id,
                child_id=b.child_id,
                date=b.date.isoformat(),
                emotion=b.emotion,
                intensity=b.intensity,
                is_sudden=b.is_sudden,
                created_at=b.created_at.isoformat(),
            )
            for b in behaviors
        ],
    )


@app.get("/therapist/children/{ref_id}/suggestions", response_model=list[TherapistSuggestionResponse])
def list_suggestions(
    ref_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    rel = get_linked_relationship(db, current_user.id, ref_id)
    if not rel:
        raise HTTPException(status_code=404, detail="No linked child found")

    child_id = rel.child_id
    if not child_id:
        child = (
            db.query(ChildProfile)
            .filter(ChildProfile.user_id == rel.parent_id)
            .order_by(ChildProfile.created_at.desc())
            .first()
        )
        child_id = child.id if child else None

    if not child_id:
        return []

    suggestions = (
        db.query(TherapistActivitySuggestion)
        .filter(
            TherapistActivitySuggestion.child_id == child_id,
            TherapistActivitySuggestion.status != "deleted",
        )
        .order_by(TherapistActivitySuggestion.created_at.desc())
        .all()
    )

    return [
        TherapistSuggestionResponse(
            id=s.id,
            therapist_id=s.therapist_id,
            parent_id=s.parent_id,
            child_id=s.child_id,
            title=s.title,
            description=s.description,
            related_pattern=s.related_pattern,
            suggested_frequency=s.suggested_frequency,
            status=s.status,
            created_at=s.created_at.isoformat(),
        )
        for s in suggestions
    ]


@app.get("/parent/child-suggestions/{child_id}")
def list_parent_child_suggestions(
    child_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get activity suggestions for a child (parent-accessible)."""
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")

    # Verify the child belongs to this parent
    child = db.query(ChildProfile).filter(
        ChildProfile.id == child_id,
        ChildProfile.user_id == current_user.id,
    ).first()
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")

    suggestions = (
        db.query(TherapistActivitySuggestion)
        .filter(
            TherapistActivitySuggestion.child_id == child_id,
            TherapistActivitySuggestion.status != "deleted",
        )
        .order_by(TherapistActivitySuggestion.created_at.desc())
        .all()
    )

    return [
        {
            "id": s.id,
            "therapist_id": s.therapist_id,
            "parent_id": s.parent_id,
            "child_id": s.child_id,
            "title": s.title,
            "description": s.description,
            "related_pattern": s.related_pattern,
            "suggested_frequency": s.suggested_frequency,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
        }
        for s in suggestions
    ]


@app.post("/therapist/children/{ref_id}/suggestions", response_model=TherapistSuggestionResponse)
def create_suggestion(
    ref_id: str,
    payload: TherapistSuggestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    rel = get_linked_relationship(db, current_user.id, ref_id)
    if not rel:
        raise HTTPException(status_code=404, detail="No linked child found")

    child_id = rel.child_id
    if not child_id:
        child = (
            db.query(ChildProfile)
            .filter(ChildProfile.user_id == rel.parent_id)
            .order_by(ChildProfile.created_at.desc())
            .first()
        )
        child_id = child.id if child else None

    if not child_id:
        raise HTTPException(status_code=404, detail="Child profile not found")

    suggestion = TherapistActivitySuggestion(
        therapist_id=current_user.id,
        parent_id=rel.parent_id,
        child_id=child_id,
        title=payload.title,
        description=payload.description,
        related_pattern=payload.related_pattern,
        suggested_frequency=payload.suggested_frequency,
        status="active",
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)

    return TherapistSuggestionResponse(
        id=suggestion.id,
        therapist_id=suggestion.therapist_id,
        parent_id=suggestion.parent_id,
        child_id=suggestion.child_id,
        title=suggestion.title,
        description=suggestion.description,
        related_pattern=suggestion.related_pattern,
        suggested_frequency=suggestion.suggested_frequency,
        status=suggestion.status,
        created_at=suggestion.created_at.isoformat(),
    )


@app.delete("/therapist/suggestions/{suggestion_id}")
def delete_suggestion(
    suggestion_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    suggestion = (
        db.query(TherapistActivitySuggestion)
        .filter(
            TherapistActivitySuggestion.id == suggestion_id,
            TherapistActivitySuggestion.therapist_id == current_user.id,
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = "deleted"
    db.commit()
    return {"ok": True}


@app.get("/therapist/children/{ref_id}/notes", response_model=list[TherapistNoteResponse])
def list_notes(
    ref_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    rel = get_linked_relationship(db, current_user.id, ref_id)
    if not rel:
        raise HTTPException(status_code=404, detail="No linked child found")

    child_id = rel.child_id
    if not child_id:
        child = (
            db.query(ChildProfile)
            .filter(ChildProfile.user_id == rel.parent_id)
            .order_by(ChildProfile.created_at.desc())
            .first()
        )
        child_id = child.id if child else None

    if not child_id:
        return []

    notes = (
        db.query(TherapistNote)
        .filter(
            TherapistNote.child_id == child_id,
            TherapistNote.therapist_id == current_user.id,
        )
        .order_by(TherapistNote.created_at.desc())
        .all()
    )

    return [
        TherapistNoteResponse(
            id=n.id,
            therapist_id=n.therapist_id,
            parent_id=n.parent_id,
            child_id=n.child_id,
            note_text=n.note_text,
            note_type=n.note_type,
            created_at=n.created_at.isoformat(),
        )
        for n in notes
    ]


@app.post("/therapist/children/{ref_id}/notes", response_model=TherapistNoteResponse)
def create_note(
    ref_id: str,
    payload: TherapistNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    rel = get_linked_relationship(db, current_user.id, ref_id)
    if not rel:
        raise HTTPException(status_code=404, detail="No linked child found")

    child_id = rel.child_id
    if not child_id:
        child = (
            db.query(ChildProfile)
            .filter(ChildProfile.user_id == rel.parent_id)
            .order_by(ChildProfile.created_at.desc())
            .first()
        )
        child_id = child.id if child else None

    if not child_id:
        raise HTTPException(status_code=404, detail="Child profile not found")

    note = TherapistNote(
        therapist_id=current_user.id,
        parent_id=rel.parent_id,
        child_id=child_id,
        note_text=payload.note_text,
        note_type=payload.note_type,
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return TherapistNoteResponse(
        id=note.id,
        therapist_id=note.therapist_id,
        parent_id=note.parent_id,
        child_id=note.child_id,
        note_text=note.note_text,
        note_type=note.note_type,
        created_at=note.created_at.isoformat(),
    )


@app.delete("/therapist/notes/{note_id}")
def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    note = (
        db.query(TherapistNote)
        .filter(
            TherapistNote.id == note_id,
            TherapistNote.therapist_id == current_user.id,
        )
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return {"ok": True}


@app.get("/therapist/alerts", response_model=list[TherapistBehaviorAlertResponse])
def list_behavior_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    relationships = (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.therapist_id == current_user.id,
            ParentTherapistRelationship.status == "accepted",
            ParentTherapistRelationship.child_id.isnot(None),
        )
        .all()
    )

    child_ids = [rel.child_id for rel in relationships if rel.child_id]
    if not child_ids:
        return []

    alerts = (
        db.query(BehaviorAlert)
        .filter(
            BehaviorAlert.child_id.in_(child_ids),
            BehaviorAlert.alert_type == "sudden_change",
        )
        .order_by(BehaviorAlert.created_at.desc())
        .all()
    )

    output: list[TherapistBehaviorAlertResponse] = []
    for alert in alerts:
        child = db.query(ChildProfile).filter(ChildProfile.id == alert.child_id).first()
        parent = db.query(User).filter(User.id == alert.parent_id).first()
        review = (
            db.query(BehaviorAlertReview)
            .filter(
                BehaviorAlertReview.alert_id == alert.id,
                BehaviorAlertReview.therapist_id == current_user.id,
            )
            .order_by(BehaviorAlertReview.created_at.desc())
            .first()
        )

        output.append(
            TherapistBehaviorAlertResponse(
                id=alert.id,
                child_id=alert.child_id,
                child_name=child.name if child else "Unknown Child",
                parent_id=alert.parent_id,
                parent_name=parent.full_name if parent and parent.full_name else "Unknown Parent",
                emotion=alert.emotion,
                intensity=alert.intensity,
                notes=alert.notes,
                alert_type=alert.alert_type,
                created_at=alert.created_at.isoformat(),
                reviewed=bool(review),
                review=(
                    TherapistAlertReviewResponse(
                        id=review.id,
                        response_note=review.response_note,
                        acknowledged=review.acknowledged,
                        reviewed_at=(review.reviewed_at.isoformat() if review.reviewed_at else None),
                    )
                    if review
                    else None
                ),
            )
        )

    return output


@app.post("/therapist/alerts/{alert_id}/acknowledge")
def acknowledge_behavior_alert(
    alert_id: str,
    payload: TherapistAlertAcknowledgeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    alert = db.query(BehaviorAlert).filter(BehaviorAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    rel = (
        db.query(ParentTherapistRelationship)
        .filter(
            ParentTherapistRelationship.therapist_id == current_user.id,
            ParentTherapistRelationship.parent_id == alert.parent_id,
            ParentTherapistRelationship.status == "accepted",
            (ParentTherapistRelationship.child_id == alert.child_id)
            | (ParentTherapistRelationship.child_id.is_(None)),
        )
        .first()
    )
    if not rel:
        raise HTTPException(status_code=403, detail="No linked relationship for this alert")

    review = (
        db.query(BehaviorAlertReview)
        .filter(
            BehaviorAlertReview.alert_id == alert_id,
            BehaviorAlertReview.therapist_id == current_user.id,
        )
        .first()
    )

    if review:
        review.acknowledged = True
        review.reviewed_at = datetime.utcnow()
        review.response_note = payload.response_note if payload.response_note is not None else review.response_note
    else:
        review = BehaviorAlertReview(
            alert_id=alert.id,
            therapist_id=current_user.id,
            parent_id=alert.parent_id,
            child_id=alert.child_id,
            acknowledged=True,
            reviewed_at=datetime.utcnow(),
            response_note=payload.response_note,
        )
        db.add(review)

    db.commit()
    return {"ok": True}


@app.get("/therapist/intensity-alerts", response_model=list[TherapistIntensityAlertResponse])
def list_intensity_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    alerts = (
        db.query(BehaviorIntensityAlert)
        .filter(BehaviorIntensityAlert.therapist_id == current_user.id)
        .order_by(BehaviorIntensityAlert.created_at.desc())
        .all()
    )

    output: list[TherapistIntensityAlertResponse] = []
    for alert in alerts:
        child = db.query(ChildProfile).filter(ChildProfile.id == alert.child_id).first()
        parent = db.query(User).filter(User.id == alert.parent_id).first()

        output.append(
            TherapistIntensityAlertResponse(
                id=alert.id,
                parent_id=alert.parent_id,
                parent_name=parent.full_name if parent and parent.full_name else "Unknown Parent",
                child_id=alert.child_id,
                child_name=child.name if child else "Unknown Child",
                consecutive_high_count=alert.consecutive_high_count,
                alert_sent_at=alert.alert_sent_at.isoformat() if alert.alert_sent_at else None,
                acknowledged=alert.acknowledged,
                created_at=alert.created_at.isoformat(),
            )
        )

    return output


@app.post("/therapist/intensity-alerts/{alert_id}/acknowledge")
def acknowledge_intensity_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    alert = (
        db.query(BehaviorIntensityAlert)
        .filter(
            BehaviorIntensityAlert.id == alert_id,
            BehaviorIntensityAlert.therapist_id == current_user.id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Intensity alert not found")

    alert.acknowledged = True
    db.commit()
    return {"ok": True}


@app.get("/therapist/profile-status", response_model=TherapistProfileStatusResponse)
def get_therapist_profile_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not profile:
        return TherapistProfileStatusResponse(verification_status="pending", rejection_reason=None)

    return TherapistProfileStatusResponse(
        verification_status=profile.verification_status,
        rejection_reason=profile.rejection_reason,
    )


@app.post("/parent/save-child-profile")
def save_child_profile(
    payload: ChildProfileSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save or update child profile for a parent. Creates if doesn't exist, updates if does."""
    try:
        # Check if child profile already exists for this user
        existing = db.query(ChildProfile).filter(ChildProfile.user_id == current_user.id).first()

        if existing:
            # Update existing profile
            existing.name = payload.name
            existing.age_years = payload.age_years
            existing.age_months = payload.age_months
            existing.communication_level = payload.communication_level
            existing.sensory_preference = payload.sensory_preference
            existing.notes = payload.notes
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return {"ok": True, "id": str(existing.id)}
        else:
            # Create new profile
            new_profile = ChildProfile(
                user_id=current_user.id,
                name=payload.name,
                age_years=payload.age_years,
                age_months=payload.age_months,
                communication_level=payload.communication_level,
                sensory_preference=payload.sensory_preference,
                notes=payload.notes,
            )
            db.add(new_profile)
            db.commit()
            db.refresh(new_profile)
            return {"ok": True, "id": str(new_profile.id)}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


def _save_upload_file(file: UploadFile, user_id: str, doc_type: str) -> str:
    import re
    safe_user_id = re.sub(r'[^a-zA-Z0-9_-]', '', user_id)
    ext = Path(file.filename or "document").suffix or ".bin"
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'}
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")
    file_name = f"{doc_type}-{uuid.uuid4().hex}{ext}"
    relative_dir = Path("therapist-documents") / safe_user_id
    absolute_dir = UPLOADS_DIR / relative_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)
    absolute_path = absolute_dir / file_name

    with absolute_path.open("wb") as out_file:
        shutil.copyfileobj(file.file, out_file)

    return str((relative_dir / file_name).as_posix())


@app.post("/auth/therapist/register", response_model=TherapistAuthResponse)
def register_therapist_account(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    qualification: str = Form(...),
    registration_number: str = Form(...),
    specialization: str | None = Form(default=None),
    clinic_name: str | None = Form(default=None),
    contact_email: str | None = Form(default=None),
    degree_certificate: UploadFile | None = File(default=None),
    license_document: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role="therapist",
    )
    db.add(user)
    db.flush()

    degree_certificate_url: str | None = None
    license_document_url: str | None = None
    if degree_certificate:
        rel_path = _save_upload_file(degree_certificate, user.id, "certificate")
        degree_certificate_url = str(request.base_url).rstrip("/") + "/uploads/" + rel_path
    if license_document:
        rel_path = _save_upload_file(license_document, user.id, "license")
        license_document_url = str(request.base_url).rstrip("/") + "/uploads/" + rel_path

    profile = TherapistProfile(
        user_id=user.id,
        full_name=full_name,
        qualification=qualification,
        specialization=specialization,
        registration_number=registration_number,
        clinic_name=clinic_name,
        contact_email=contact_email or email,
        degree_certificate_url=degree_certificate_url,
        license_document_url=license_document_url,
        verification_status="verified",
        verified_at=datetime.utcnow(),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    db.refresh(user)

    token = create_access_token(user.id)
    return TherapistAuthResponse(
        access_token=token,
        token_type="bearer",
        user=TherapistAuthUserResponse(id=user.id, email=user.email, full_name=user.full_name),
        therapist_profile=TherapistProfileBasicResponse(
            id=profile.id,
            full_name=profile.full_name,
            qualification=profile.qualification,
            specialization=profile.specialization,
            registration_number=profile.registration_number,
            clinic_name=profile.clinic_name,
            verification_status=profile.verification_status,
        ),
    )


@app.post("/auth/therapist/login", response_model=TherapistAuthResponse)
def login_therapist(
    payload: TherapistLoginRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.role != "therapist" or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist profile not found")

    token = create_access_token(user.id)
    return TherapistAuthResponse(
        access_token=token,
        token_type="bearer",
        user=TherapistAuthUserResponse(id=user.id, email=user.email, full_name=user.full_name),
        therapist_profile=TherapistProfileBasicResponse(
            id=profile.id,
            full_name=profile.full_name,
            qualification=profile.qualification,
            specialization=profile.specialization,
            registration_number=profile.registration_number,
            clinic_name=profile.clinic_name,
            verification_status=profile.verification_status,
        ),
    )


@app.get("/therapist/me", response_model=TherapistAuthResponse)
def therapist_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Therapist role required")

    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist profile not found")

    token = create_access_token(current_user.id)
    return TherapistAuthResponse(
        access_token=token,
        token_type="bearer",
        user=TherapistAuthUserResponse(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
        ),
        therapist_profile=TherapistProfileBasicResponse(
            id=profile.id,
            full_name=profile.full_name,
            qualification=profile.qualification,
            specialization=profile.specialization,
            registration_number=profile.registration_number,
            clinic_name=profile.clinic_name,
            verification_status=profile.verification_status,
        ),
    )


@app.post("/therapist/register-profile")
def register_therapist_profile(
    request: Request,
    full_name: str = Form(...),
    qualification: str = Form(...),
    registration_number: str = Form(...),
    specialization: str | None = Form(default=None),
    clinic_name: str | None = Form(default=None),
    contact_email: str | None = Form(default=None),
    degree_certificate: UploadFile | None = File(default=None),
    license_document: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    degree_certificate_url: str | None = None
    license_document_url: str | None = None

    if degree_certificate:
        rel_path = _save_upload_file(degree_certificate, current_user.id, "certificate")
        degree_certificate_url = str(request.base_url).rstrip("/") + "/uploads/" + rel_path

    if license_document:
        rel_path = _save_upload_file(license_document, current_user.id, "license")
        license_document_url = str(request.base_url).rstrip("/") + "/uploads/" + rel_path

    payload = TherapistRegistrationPayload(
        user_id=current_user.id,
        full_name=full_name,
        qualification=qualification,
        registration_number=registration_number,
        specialization=specialization,
        clinic_name=clinic_name,
        contact_email=contact_email,
        degree_certificate_url=degree_certificate_url,
        license_document_url=license_document_url,
    )

    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not profile:
        profile = TherapistProfile(
            user_id=current_user.id,
            full_name=payload.full_name,
            qualification=payload.qualification,
            registration_number=payload.registration_number,
            specialization=payload.specialization,
            clinic_name=payload.clinic_name,
            contact_email=payload.contact_email,
            degree_certificate_url=payload.degree_certificate_url,
            license_document_url=payload.license_document_url,
            verification_status="verified",
            verified_at=datetime.utcnow(),
        )
        db.add(profile)
    else:
        profile.full_name = payload.full_name
        profile.qualification = payload.qualification
        profile.registration_number = payload.registration_number
        profile.specialization = payload.specialization
        profile.clinic_name = payload.clinic_name
        profile.contact_email = payload.contact_email
        if payload.degree_certificate_url:
            profile.degree_certificate_url = payload.degree_certificate_url
        if payload.license_document_url:
            profile.license_document_url = payload.license_document_url
        profile.verification_status = "verified"
        profile.verified_at = datetime.utcnow()
        profile.updated_at = datetime.utcnow()

    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────
# Parent Auth Endpoints
# ─────────────────────────────────────────

from pydantic import BaseModel as PydanticBase

class ParentRegisterRequest(PydanticBase):
    email: str
    password: str
    full_name: str = ""

class ParentLoginRequest(PydanticBase):
    email: str
    password: str

class ParentUserResponse(PydanticBase):
    id: str
    email: str
    full_name: str
    role: str

class ParentAuthResponse(PydanticBase):
    access_token: str
    token_type: str
    user: ParentUserResponse


@app.post("/auth/parent/register", response_model=ParentAuthResponse)
def parent_register(payload: ParentRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="parent",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return ParentAuthResponse(
        access_token=token,
        token_type="bearer",
        user=ParentUserResponse(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )


@app.post("/auth/parent/login", response_model=ParentAuthResponse)
def parent_login(payload: ParentLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email, User.role == "parent").first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.id)
    return ParentAuthResponse(
        access_token=token,
        token_type="bearer",
        user=ParentUserResponse(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )


@app.get("/auth/parent/me", response_model=ParentAuthResponse)
def parent_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    token = create_access_token(current_user.id)
    return ParentAuthResponse(
        access_token=token,
        token_type="bearer",
        user=ParentUserResponse(id=current_user.id, email=current_user.email, full_name=current_user.full_name, role=current_user.role),
    )


# ─────────────────────────────────────────
# Parent Data Endpoints
# ─────────────────────────────────────────

import json as _json


@app.get("/parent/data")
def get_parent_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")

    routines = db.query(RoutineEntry).filter(RoutineEntry.user_id == current_user.id).order_by(RoutineEntry.created_at.desc()).all()
    behaviors = db.query(BehaviorEntry).filter(BehaviorEntry.user_id == current_user.id).order_by(BehaviorEntry.created_at.desc()).all()
    meds = db.query(Medication).filter(Medication.user_id == current_user.id).order_by(Medication.created_at.desc()).all()
    summaries = db.query(DailySummary).filter(DailySummary.user_id == current_user.id).order_by(DailySummary.date.desc()).all()
    child_profiles = db.query(ChildProfile).filter(ChildProfile.user_id == current_user.id).all()

    def date_str(d):
        return str(d) if d else None

    return {
        "child_profiles": [{
            "id": cp.id, "name": cp.name, "age_years": cp.age_years,
            "age_months": cp.age_months, "communication_level": cp.communication_level,
            "sensory_preference": cp.sensory_preference, "notes": cp.notes,
        } for cp in child_profiles],
        "routine_entries": [{
            "id": r.id, "child_id": r.child_id, "date": date_str(r.date),
            "type": r.type, "start_time": r.start_time, "end_time": r.end_time,
            "notes": r.notes, "voice_note_url": r.voice_note_url, "created_at": r.created_at.isoformat(),
        } for r in routines],
        "behavior_entries": [{
            "id": b.id, "child_id": b.child_id, "date": date_str(b.date),
            "emotion": b.emotion, "intensity": b.intensity, "trigger": b.trigger,
            "notes": b.notes, "is_sudden": b.is_sudden, "created_at": b.created_at.isoformat(),
        } for b in behaviors],
        "medications": [{
            "id": m.id, "child_id": m.child_id, "name": m.name,
            "time": m.time, "frequency": m.frequency, "notes": m.notes,
            "enabled": m.enabled, "created_at": m.created_at.isoformat(),
        } for m in meds],
        "daily_summaries": [{
            "id": s.id, "date": date_str(s.date), "sleep_quality": s.sleep_quality,
            "mood_overview": s.mood_overview,
            "highlights": _json.loads(s.highlights) if s.highlights else [],
            "positive_notes": s.positive_notes,
            "generated_at": s.generated_at.isoformat() if s.generated_at else s.created_at.isoformat(),
            "created_at": s.created_at.isoformat(),
        } for s in summaries],
    }


# Routine entries
class RoutineEntryCreate(PydanticBase):
    child_id: str | None = None
    date: str
    type: str
    start_time: str | None = None
    end_time: str | None = None
    notes: str | None = None
    voice_note_url: str | None = None


@app.post("/parent/routine-entries")
def add_routine_entry(payload: RoutineEntryCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    from datetime import date as dt_date
    entry = RoutineEntry(
        user_id=current_user.id,
        child_id=payload.child_id,
        date=dt_date.fromisoformat(payload.date),
        type=payload.type,
        start_time=payload.start_time,
        end_time=payload.end_time,
        notes=payload.notes,
        voice_note_url=payload.voice_note_url,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "child_id": entry.child_id, "date": str(entry.date), "type": entry.type,
            "start_time": entry.start_time, "end_time": entry.end_time, "notes": entry.notes,
            "voice_note_url": entry.voice_note_url, "created_at": entry.created_at.isoformat()}


# Behavior entries
class BehaviorEntryCreate(PydanticBase):
    child_id: str | None = None
    date: str
    emotion: str
    intensity: str = "moderate"
    trigger: str | None = None
    notes: str | None = None
    is_sudden: bool = False


@app.post("/parent/behavior-entries")
def add_behavior_entry(payload: BehaviorEntryCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    from datetime import date as dt_date
    entry = BehaviorEntry(
        user_id=current_user.id,
        child_id=payload.child_id,
        date=dt_date.fromisoformat(payload.date),
        emotion=payload.emotion,
        intensity=payload.intensity,
        trigger=payload.trigger,
        notes=payload.notes,
        is_sudden=payload.is_sudden,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Auto-alert: check last 3 entries for consecutive high intensity
    if payload.intensity == "high" and payload.child_id:
        recent = (db.query(BehaviorEntry)
                  .filter(BehaviorEntry.user_id == current_user.id, BehaviorEntry.child_id == payload.child_id)
                  .order_by(BehaviorEntry.created_at.desc()).limit(3).all())
        if len(recent) >= 3 and all(e.intensity == "high" for e in recent):
            rels = (db.query(ParentTherapistRelationship)
                    .filter(ParentTherapistRelationship.parent_id == current_user.id,
                            ParentTherapistRelationship.child_id == payload.child_id,
                            ParentTherapistRelationship.status == "accepted").all())
            for rel in rels:
                alert = BehaviorIntensityAlert(
                    therapist_id=rel.therapist_id,
                    parent_id=current_user.id,
                    child_id=payload.child_id,
                    consecutive_high_count=3,
                    alert_sent_at=datetime.utcnow(),
                )
                db.add(alert)
            db.commit()

    return {"id": entry.id, "child_id": entry.child_id, "date": str(entry.date), "emotion": entry.emotion,
            "intensity": entry.intensity, "trigger": entry.trigger, "notes": entry.notes,
            "is_sudden": entry.is_sudden, "created_at": entry.created_at.isoformat()}


# Behavior alert sharing (sudden change)
class BehaviorAlertShareRequest(PydanticBase):
    child_id: str
    behavior_entry_id: str
    therapist_ids: list[str]
    emotion: str
    intensity: str
    notes: str | None = None


@app.post("/parent/behavior-alert-share")
def share_behavior_alert(payload: BehaviorAlertShareRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    created = []
    for therapist_id in payload.therapist_ids:
        alert = BehaviorAlert(
            child_id=payload.child_id,
            parent_id=current_user.id,
            emotion=payload.emotion,
            intensity=payload.intensity,
            notes=payload.notes,
            alert_type="sudden_change",
        )
        db.add(alert)
        created.append(alert.id)
    db.commit()
    return {"ok": True, "created": len(created)}


# Medications
class MedicationCreate(PydanticBase):
    child_id: str | None = None
    name: str
    time: str | None = None
    frequency: str = "daily"
    notes: str | None = None
    enabled: bool = True


class MedicationUpdate(PydanticBase):
    name: str | None = None
    time: str | None = None
    frequency: str | None = None
    notes: str | None = None
    enabled: bool | None = None


@app.post("/parent/medications")
def add_medication(payload: MedicationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    med = Medication(
        user_id=current_user.id,
        child_id=payload.child_id,
        name=payload.name,
        time=payload.time,
        frequency=payload.frequency,
        notes=payload.notes,
        enabled=payload.enabled,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return {"id": med.id, "name": med.name, "time": med.time, "frequency": med.frequency,
            "notes": med.notes, "enabled": med.enabled, "created_at": med.created_at.isoformat()}


@app.patch("/parent/medications/{med_id}")
def update_medication(med_id: str, payload: MedicationUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    med = db.query(Medication).filter(Medication.id == med_id, Medication.user_id == current_user.id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    if payload.name is not None: med.name = payload.name
    if payload.time is not None: med.time = payload.time
    if payload.frequency is not None: med.frequency = payload.frequency
    if payload.notes is not None: med.notes = payload.notes
    if payload.enabled is not None: med.enabled = payload.enabled
    db.commit()
    return {"id": med.id, "name": med.name, "time": med.time, "frequency": med.frequency,
            "notes": med.notes, "enabled": med.enabled}


@app.delete("/parent/medications/{med_id}")
def delete_medication(med_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    med = db.query(Medication).filter(Medication.id == med_id, Medication.user_id == current_user.id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    db.delete(med)
    db.commit()
    return {"ok": True}


# Shared reports
class SharedReportCreate(PydanticBase):
    child_id: str | None = None
    report_type: str = "behavioral"
    date_range_start: str | None = None
    date_range_end: str | None = None
    report_data: dict | None = None
    expires_at: str | None = None


@app.post("/parent/shared-reports")
def create_shared_report(payload: SharedReportCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    import secrets
    share_token = secrets.token_urlsafe(32)
    report = SharedReport(
        user_id=current_user.id,
        child_id=payload.child_id,
        share_token=share_token,
        report_type=payload.report_type,
        date_range_start=payload.date_range_start,
        date_range_end=payload.date_range_end,
        report_data=_json.dumps(payload.report_data) if payload.report_data else None,
        expires_at=datetime.fromisoformat(payload.expires_at) if payload.expires_at else None,
    )
    db.add(report)
    db.commit()
    return {"ok": True, "token": share_token}


@app.get("/shared-report/{token}")
def get_shared_report(token: str, db: Session = Depends(get_db)):
    report = db.query(SharedReport).filter(SharedReport.share_token == token).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.expires_at and report.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Report link has expired")
    return {
        "share_token": report.share_token,
        "report_type": report.report_type,
        "date_range_start": report.date_range_start,
        "date_range_end": report.date_range_end,
        "report_data": _json.loads(report.report_data) if report.report_data else None,
        "created_at": report.created_at.isoformat(),
    }


# Linked therapists for a parent (for behavior sharing UI)
@app.get("/parent/linked-therapists")
def get_linked_therapists(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent role required")
    rels = (db.query(ParentTherapistRelationship)
            .filter(ParentTherapistRelationship.parent_id == current_user.id,
                    ParentTherapistRelationship.status == "accepted").all())
    result = []
    for rel in rels:
        t_user = db.query(User).filter(User.id == rel.therapist_id).first()
        t_profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == rel.therapist_id).first()
        result.append({
            "therapist_id": rel.therapist_id,
            "child_id": rel.child_id,
            "full_name": t_profile.full_name if t_profile else (t_user.full_name if t_user else "Therapist"),
        })
    return result


# ─────────────────────────────────────────
# Admin Therapist Verification Endpoints
# ─────────────────────────────────────────

@app.patch("/admin/therapist/{therapist_profile_id}/verify")
def admin_verify_therapist(
    therapist_profile_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin endpoint to verify a therapist profile."""
    profile = db.query(TherapistProfile).filter(TherapistProfile.id == therapist_profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist profile not found")
    profile.verification_status = "verified"
    profile.verified_at = datetime.utcnow()
    profile.verified_by = current_user.id
    db.commit()
    return {"ok": True, "verification_status": "verified"}


@app.patch("/admin/therapist/{therapist_profile_id}/reject")
def admin_reject_therapist(
    therapist_profile_id: str,
    reason: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin endpoint to reject a therapist profile."""
    profile = db.query(TherapistProfile).filter(TherapistProfile.id == therapist_profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist profile not found")
    profile.verification_status = "rejected"
    profile.rejection_reason = reason
    db.commit()
    return {"ok": True, "verification_status": "rejected"}


@app.get("/admin/therapists/pending")
def admin_list_pending_therapists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all therapists with pending verification."""
    pending = db.query(TherapistProfile).filter(TherapistProfile.verification_status == "pending").all()
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "full_name": p.full_name,
            "qualification": p.qualification,
            "registration_number": p.registration_number,
            "specialization": p.specialization,
            "clinic_name": p.clinic_name,
            "contact_email": p.contact_email,
            "verification_status": p.verification_status,
        }
        for p in pending
    ]
