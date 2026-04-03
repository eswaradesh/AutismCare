import json
import uuid
from datetime import datetime, date as dt_date

from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey, Text, Date
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    full_name: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="parent")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ChildProfile(Base):
    __tablename__ = "child_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String)
    age_years: Mapped[int] = mapped_column(Integer, default=0)
    age_months: Mapped[int] = mapped_column(Integer, default=0)
    communication_level: Mapped[str] = mapped_column(String, default="developing")
    sensory_preference: Mapped[str] = mapped_column(String, default="mixed")
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ParentTherapistRelationship(Base):
    __tablename__ = "parent_therapist_relationships"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    therapist_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str | None] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String, default="accepted")
    access_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RoutineEntry(Base):
    __tablename__ = "routine_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str | None] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    date: Mapped[dt_date] = mapped_column(Date)
    type: Mapped[str] = mapped_column(String)
    start_time: Mapped[str | None] = mapped_column(String, nullable=True)
    end_time: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_note_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BehaviorEntry(Base):
    __tablename__ = "behavior_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str | None] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    date: Mapped[dt_date] = mapped_column(Date)
    emotion: Mapped[str] = mapped_column(String)
    intensity: Mapped[str] = mapped_column(String, default="moderate")
    trigger: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sudden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str | None] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    date: Mapped[dt_date] = mapped_column(Date)
    sleep_quality: Mapped[str | None] = mapped_column(String, nullable=True)
    mood_overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    highlights: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    positive_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str | None] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String)
    time: Mapped[str | None] = mapped_column(String, nullable=True)
    frequency: Mapped[str] = mapped_column(String, default="daily")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SharedReport(Base):
    __tablename__ = "shared_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str | None] = mapped_column(String, nullable=True)
    share_token: Mapped[str] = mapped_column(String, unique=True, index=True)
    report_type: Mapped[str] = mapped_column(String, default="behavioral")
    date_range_start: Mapped[str | None] = mapped_column(String, nullable=True)
    date_range_end: Mapped[str | None] = mapped_column(String, nullable=True)
    report_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TherapistProfile(Base):
    __tablename__ = "therapist_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String, default="")
    qualification: Mapped[str] = mapped_column(String, default="")
    specialization: Mapped[str | None] = mapped_column(String, nullable=True)
    registration_number: Mapped[str] = mapped_column(String, default="")
    clinic_name: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    degree_certificate_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    license_document_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(String, default="pending")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TherapistActivitySuggestion(Base):
    __tablename__ = "therapist_activity_suggestions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    therapist_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_pattern: Mapped[str | None] = mapped_column(String, nullable=True)
    suggested_frequency: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TherapistNote(Base):
    __tablename__ = "therapist_notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    therapist_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    note_text: Mapped[str] = mapped_column(Text)
    note_type: Mapped[str] = mapped_column(String, default="observational")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BehaviorAlert(Base):
    __tablename__ = "behavior_alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    child_id: Mapped[str] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    emotion: Mapped[str] = mapped_column(String)
    intensity: Mapped[str] = mapped_column(String, default="moderate")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    alert_type: Mapped[str] = mapped_column(String, default="sudden_change")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BehaviorAlertReview(Base):
    __tablename__ = "behavior_alert_reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id: Mapped[str] = mapped_column(String, ForeignKey("behavior_alerts.id", ondelete="CASCADE"), index=True)
    therapist_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    response_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BehaviorIntensityAlert(Base):
    __tablename__ = "behavior_intensity_alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    therapist_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    child_id: Mapped[str] = mapped_column(String, ForeignKey("child_profiles.id", ondelete="CASCADE"), index=True)
    consecutive_high_count: Mapped[int] = mapped_column(Integer, default=0)
    alert_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
