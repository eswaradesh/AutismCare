import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, Base, engine
from app.models import ChildProfile
from datetime import datetime

try:
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    payload = {
        "user_id": "800ef5f3-4562-4610-b10c-d2ee106357ff",
        "name": "Test Child New",
        "age_years": 5,
        "age_months": 6,
        "communication_level": "verbal",
        "sensory_preference": "avoiding",
        "notes": "test notes"
    }
    
    # Try to create a profile
    new_profile = ChildProfile(
        user_id=payload["user_id"],
        name=payload["name"],
        age_years=payload["age_years"],
        age_months=payload["age_months"],
        communication_level=payload["communication_level"],
        sensory_preference=payload["sensory_preference"],
        notes=payload["notes"],
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    print(f"Success! Created profile with ID: {new_profile.id}")
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
