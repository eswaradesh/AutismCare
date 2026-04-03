"""
Seed script to create demo accounts with 2+ weeks of pre-loaded data.

Usage:
    cd backend/api
    python seed_demo_data.py

Creates:
    - Parent: parent@demo.com / Demo@1234
    - Therapist: therapist@demo.com / Demo@1234
    - Child profile: Arjun, 5yr 3mo
    - 16 days of routine + behavior entries with realistic patterns
    - Medications, therapist suggestions, parent-therapist relationship
"""

import os
import sys
import uuid
import random
from datetime import datetime, timedelta, date as dt_date

# Ensure the app package is importable
sys.path.insert(0, os.path.dirname(__file__))

# Load .env file from project root if available
_env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                os.environ.setdefault(key.strip(), val.strip())

if not os.environ.get("JWT_SECRET"):
    print("ERROR: JWT_SECRET not set. Create a .env file in the project root or set it in environment.")
    sys.exit(1)

from app.database import engine, Base, SessionLocal
from app.models import (
    User, ChildProfile, RoutineEntry, BehaviorEntry, Medication,
    ParentTherapistRelationship, TherapistProfile, TherapistActivitySuggestion,
    TherapistNote,
)
from app.auth import hash_password

# Create tables
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def clean_existing():
    """Remove existing demo data if present."""
    for email in ["parent@demo.com", "therapist@demo.com"]:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # Delete cascade-related records
            db.query(RoutineEntry).filter(RoutineEntry.user_id == existing.id).delete()
            db.query(BehaviorEntry).filter(BehaviorEntry.user_id == existing.id).delete()
            db.query(Medication).filter(Medication.user_id == existing.id).delete()
            db.query(ParentTherapistRelationship).filter(
                (ParentTherapistRelationship.parent_id == existing.id) |
                (ParentTherapistRelationship.therapist_id == existing.id)
            ).delete()
            db.query(ChildProfile).filter(ChildProfile.user_id == existing.id).delete()
            tp = db.query(TherapistProfile).filter(TherapistProfile.user_id == existing.id).first()
            if tp:
                db.query(TherapistActivitySuggestion).filter(TherapistActivitySuggestion.therapist_id == existing.id).delete()
                db.query(TherapistNote).filter(TherapistNote.therapist_id == existing.id).delete()
                db.delete(tp)
            db.delete(existing)
    db.commit()

def create_demo_data():
    random.seed(42)

    # ── Parent account ──
    parent_id = str(uuid.uuid4())
    parent = User(
        id=parent_id,
        email="parent@demo.com",
        password_hash=hash_password("Demo@1234"),
        full_name="Priya Sharma",
        role="parent",
    )
    db.add(parent)

    # ── Child profile ──
    child_id = str(uuid.uuid4())
    child = ChildProfile(
        id=child_id,
        user_id=parent_id,
        name="Arjun",
        age_years=5,
        age_months=3,
        communication_level="limited",
        sensory_preference="seeking",
        notes="Responds well to visual schedules. Enjoys music and water play.",
    )
    db.add(child)

    # ── Therapist account ──
    therapist_id = str(uuid.uuid4())
    therapist = User(
        id=therapist_id,
        email="therapist@demo.com",
        password_hash=hash_password("Demo@1234"),
        full_name="Dr. Kavitha Reddy",
        role="therapist",
    )
    db.add(therapist)

    therapist_profile = TherapistProfile(
        id=str(uuid.uuid4()),
        user_id=therapist_id,
        full_name="Dr. Kavitha Reddy",
        qualification="M.Sc. Clinical Psychology, RCI Licensed",
        specialization="ABA Therapy, Sensory Integration",
        registration_number="RCI-2024-78542",
        clinic_name="Bright Minds Therapy Center",
        contact_email="therapist@demo.com",
        verification_status="verified",
        verified_at=datetime.utcnow(),
    )
    db.add(therapist_profile)

    # ── Parent-Therapist Relationship ──
    relationship = ParentTherapistRelationship(
        parent_id=parent_id,
        therapist_id=therapist_id,
        child_id=child_id,
        status="accepted",
    )
    db.add(relationship)

    # ── Medications ──
    med1 = Medication(
        user_id=parent_id,
        child_id=child_id,
        name="Risperidone 0.5mg",
        time="08:00",
        frequency="daily",
        notes="With breakfast",
        enabled=True,
    )
    med2 = Medication(
        user_id=parent_id,
        child_id=child_id,
        name="Melatonin 1mg",
        time="20:30",
        frequency="daily",
        notes="30 minutes before bedtime",
        enabled=True,
    )
    db.add_all([med1, med2])

    # ── Generate 16 days of entries ──
    today = dt_date.today()
    start_date = today - timedelta(days=15)

    sleep_notes = [
        "Slept well through the night",
        "Woke up once around 2am, settled back quickly",
        "Had difficulty falling asleep, took 30 min",
        "Good sleep, woke up happy",
        "Restless night, tossing and turning",
        "Peaceful sleep after bedtime story",
        "Slept through without any disturbance",
        "Woke up early at 5:30am",
    ]

    food_notes = [
        "Ate breakfast well - idli and fruit",
        "Picky with lunch, only ate rice",
        "Good appetite today, ate vegetables",
        "Refused dinner initially, ate after 20 mins",
        "Enjoyed snack time with peers",
        "Drank milk and had chapati",
        "Tried new food item - accepted after hesitation",
        "Regular meals, good intake",
    ]

    activity_notes = [
        "Played with building blocks for 40 mins",
        "Water play session - very engaged",
        "Drawing and coloring activity",
        "Outdoor play at park with swings",
        "Sensory bin activity with rice and beans",
        "Music therapy session - responded to rhythm",
        "Puzzle solving - completed 12-piece puzzle",
        "Social play with neighbor's child",
    ]

    therapy_notes = [
        "ABA session - worked on requesting skills",
        "Speech therapy - practiced 2-word phrases",
        "OT session focused on fine motor skills",
        "Behavioral therapy - turn-taking practice",
        "Group therapy session - social interaction",
        "Speech therapy - sound imitation exercises",
    ]

    emotions = ["happy", "calm", "anxious", "upset"]
    intensities = ["low", "moderate", "high"]

    behavior_notes_map = {
        "happy": [
            "Smiling and laughing during play",
            "Very cheerful today, good eye contact",
            "Enjoyed music, was dancing",
            "Happy mood throughout the morning",
        ],
        "calm": [
            "Relaxed and focused during activities",
            "Calm after sensory break",
            "Peaceful morning, transitioned well",
            "Steady mood, cooperative behavior",
        ],
        "anxious": [
            "Seemed nervous during transition to new activity",
            "Clingy behavior before therapy session",
            "Covering ears during loud sounds",
            "Worried expression, needed reassurance",
        ],
        "upset": [
            "Meltdown during grocery store visit",
            "Crying episode after routine change",
            "Frustrated with puzzle, threw pieces",
            "Tantrum during bath time",
        ],
    }

    for day_offset in range(16):
        current_date = start_date + timedelta(days=day_offset)
        is_weekend = current_date.weekday() >= 5
        is_therapy_day = current_date.weekday() in [1, 3, 5]  # Tue, Thu, Sat

        # Sleep entry (every day)
        sleep_start_hour = random.choice([20, 20, 21, 21, 21, 22])
        sleep_end_hour = random.choice([6, 6, 7, 7, 7, 8])
        db.add(RoutineEntry(
            user_id=parent_id, child_id=child_id, date=current_date,
            type="sleep",
            start_time=f"{sleep_start_hour}:{'00' if random.random() > 0.5 else '30'}",
            end_time=f"{sleep_end_hour:02d}:{'00' if random.random() > 0.5 else '30'}",
            notes=random.choice(sleep_notes),
        ))

        # Food entries (2-3 per day)
        for meal_time in ["08:30", "12:30", "19:00"]:
            if random.random() > 0.15:  # 85% chance of logging each meal
                db.add(RoutineEntry(
                    user_id=parent_id, child_id=child_id, date=current_date,
                    type="food",
                    start_time=meal_time,
                    notes=random.choice(food_notes),
                ))

        # Activity entries (1-2 per day)
        num_activities = random.choice([1, 1, 2, 2, 3]) if is_weekend else random.choice([1, 1, 2])
        for _ in range(num_activities):
            db.add(RoutineEntry(
                user_id=parent_id, child_id=child_id, date=current_date,
                type="activity",
                start_time=f"{random.choice([10, 14, 16])}:00",
                end_time=f"{random.choice([11, 15, 17])}:00",
                notes=random.choice(activity_notes),
            ))

        # Therapy entries (on therapy days only)
        if is_therapy_day:
            db.add(RoutineEntry(
                user_id=parent_id, child_id=child_id, date=current_date,
                type="therapy",
                start_time="10:00",
                end_time="11:00",
                notes=random.choice(therapy_notes),
            ))

        # Behavior entries (1-2 per day with realistic patterns)
        # Therapy days tend to be calmer; weekends more variable
        if is_therapy_day:
            emotion_weights = [0.35, 0.40, 0.15, 0.10]  # happy, calm, anxious, upset
            intensity_weights = [0.45, 0.40, 0.15]  # low, moderate, high
        elif is_weekend:
            emotion_weights = [0.20, 0.20, 0.30, 0.30]
            intensity_weights = [0.20, 0.40, 0.40]
        else:
            emotion_weights = [0.25, 0.30, 0.25, 0.20]
            intensity_weights = [0.30, 0.45, 0.25]

        num_behaviors = random.choice([1, 1, 2, 2])
        for _ in range(num_behaviors):
            emotion = random.choices(emotions, weights=emotion_weights, k=1)[0]
            intensity = random.choices(intensities, weights=intensity_weights, k=1)[0]
            is_sudden = (emotion in ["upset", "anxious"] and intensity == "high" and random.random() > 0.6)
            db.add(BehaviorEntry(
                user_id=parent_id, child_id=child_id, date=current_date,
                emotion=emotion, intensity=intensity,
                trigger="routine change" if is_sudden else None,
                notes=random.choice(behavior_notes_map[emotion]),
                is_sudden=is_sudden,
            ))

    # Ensure at least 2 sudden change entries for demo purposes
    sudden_dates = [today - timedelta(days=3), today - timedelta(days=1)]
    for sd in sudden_dates:
        db.add(BehaviorEntry(
            user_id=parent_id, child_id=child_id, date=sd,
            emotion="upset", intensity="high",
            trigger="unexpected schedule change",
            notes="Sudden meltdown after routine was disrupted. Needed 20 minutes to calm down.",
            is_sudden=True,
        ))

    # ── Therapist Activity Suggestions ──
    suggestions = [
        ("Sensory Calm-Down Kit", "Create a portable sensory kit with fidget toys, noise-cancelling headphones, and a weighted lap pad for transitions.", "sensory_seeking", "as needed"),
        ("Visual Schedule Board", "Use a picture-based daily schedule board to help with transitions. Review it together each morning.", "transition_anxiety", "daily"),
        ("Deep Pressure Activities", "Include 10-15 minutes of deep pressure activities like bear hugs, weighted blanket time, or wall pushups before challenging tasks.", "emotional_regulation", "2-3 times/week"),
    ]
    for title, desc, pattern, freq in suggestions:
        db.add(TherapistActivitySuggestion(
            therapist_id=therapist_id, child_id=child_id, parent_id=parent_id,
            title=title, description=desc,
            related_pattern=pattern, suggested_frequency=freq,
            status="active",
        ))

    # ── Therapist Notes ──
    db.add(TherapistNote(
        therapist_id=therapist_id, parent_id=parent_id, child_id=child_id,
        note_text="Arjun is making good progress with requesting skills. Parents are consistently using visual supports at home which is helping. Recommend continuing ABA 3x/week.",
        note_type="observational",
    ))
    db.add(TherapistNote(
        therapist_id=therapist_id, parent_id=parent_id, child_id=child_id,
        note_text="Noticed calmer behavior on therapy days based on parent logs. The sensory breaks before transitions seem to be helping. Will work on extending social interaction time in next sessions.",
        note_type="observational",
    ))

    db.commit()
    print("Demo data seeded successfully!")
    print(f"  Parent:    parent@demo.com / Demo@1234")
    print(f"  Therapist: therapist@demo.com / Demo@1234")
    print(f"  Child:     Arjun (ID: {child_id})")
    print(f"  Entries:   16 days of routines + behaviors")

if __name__ == "__main__":
    clean_existing()
    create_demo_data()
    db.close()
