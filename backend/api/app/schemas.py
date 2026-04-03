from pydantic import BaseModel


class TherapistChildProfileResponse(BaseModel):
    relationship_id: str | None = None
    child_id: str
    child_name: str
    age_years: int
    age_months: int
    communication_level: str
    sensory_preference: str
    parent_id: str
    parent_name: str


class TherapistChildSummary(BaseModel):
    relationship_id: str
    child_id: str
    child_name: str
    parent_id: str
    parent_name: str
    status: str
    last_report_date: str | None = None
    routine_count: int = 0
    behavior_count: int = 0
    needs_attention: bool = False


class TherapistSuggestionCreate(BaseModel):
    title: str
    description: str | None = None
    related_pattern: str | None = None
    suggested_frequency: str | None = None


class TherapistSuggestionResponse(BaseModel):
    id: str
    therapist_id: str
    parent_id: str
    child_id: str
    title: str
    description: str | None = None
    related_pattern: str | None = None
    suggested_frequency: str | None = None
    status: str
    created_at: str


class TherapistNoteCreate(BaseModel):
    note_text: str
    note_type: str = "observational"


class TherapistNoteResponse(BaseModel):
    id: str
    therapist_id: str
    parent_id: str
    child_id: str
    note_text: str
    note_type: str
    created_at: str


class TherapistRoutineEntryResponse(BaseModel):
    id: str
    child_id: str
    date: str
    type: str
    notes: str | None = None
    created_at: str


class TherapistBehaviorEntryResponse(BaseModel):
    id: str
    child_id: str
    date: str
    emotion: str
    intensity: str
    is_sudden: bool
    created_at: str


class TherapistChildEntriesResponse(BaseModel):
    routines: list[TherapistRoutineEntryResponse]
    behaviors: list[TherapistBehaviorEntryResponse]


class TherapistAlertReviewResponse(BaseModel):
    id: str
    response_note: str | None = None
    acknowledged: bool
    reviewed_at: str | None = None


class TherapistBehaviorAlertResponse(BaseModel):
    id: str
    child_id: str
    child_name: str
    parent_id: str
    parent_name: str
    emotion: str
    intensity: str
    notes: str | None = None
    alert_type: str
    created_at: str
    reviewed: bool
    review: TherapistAlertReviewResponse | None = None


class TherapistIntensityAlertResponse(BaseModel):
    id: str
    parent_id: str
    parent_name: str
    child_id: str
    child_name: str
    consecutive_high_count: int
    alert_sent_at: str | None = None
    acknowledged: bool
    created_at: str


class TherapistAlertAcknowledgeRequest(BaseModel):
    response_note: str | None = None


class TherapistProfileStatusResponse(BaseModel):
    verification_status: str
    rejection_reason: str | None = None


class TherapistRegistrationPayload(BaseModel):
    user_id: str
    full_name: str
    qualification: str
    registration_number: str
    specialization: str | None = None
    clinic_name: str | None = None
    contact_email: str | None = None
    degree_certificate_url: str | None = None
    license_document_url: str | None = None


class TherapistAuthUserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None = None


class TherapistProfileBasicResponse(BaseModel):
    id: str
    full_name: str
    qualification: str
    specialization: str | None = None
    registration_number: str
    clinic_name: str | None = None
    verification_status: str


class PublicTherapistDirectoryItemResponse(BaseModel):
    id: str
    user_id: str
    full_name: str
    qualification: str
    specialization: str | None = None
    clinic_name: str | None = None
    contact_email: str | None = None
    verification_status: str


class ParentTherapistConnectRequest(BaseModel):
    parent_id: str
    parent_email: str
    parent_name: str | None = None
    child_id: str
    child_name: str | None = None
    therapist_id: str


class ParentTherapistRevokeRequest(BaseModel):
    parent_id: str


class ParentTherapistRelationshipResponse(BaseModel):
    id: str
    parent_id: str
    therapist_id: str
    child_id: str | None = None
    status: str
    created_at: str


class TherapistAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: TherapistAuthUserResponse
    therapist_profile: TherapistProfileBasicResponse


class TherapistLoginRequest(BaseModel):
    email: str
    password: str


class ChildProfileSaveRequest(BaseModel):
    user_id: str
    name: str
    age_years: int = 0
    age_months: int = 0
    communication_level: str
    sensory_preference: str
    notes: str | None = None
