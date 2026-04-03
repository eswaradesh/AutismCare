import requests
import json

payload = {
    "user_id": "800ef5f3-4562-4610-b10c-d2ee106357ff",
    "name": "Test Child",
    "age_years": 5,
    "age_months": 6,
    "communication_level": "verbal",
    "sensory_preference": "avoiding",
    "notes": "test notes"
}

try:
    response = requests.post(
        "http://127.0.0.1:8001/parent/save-child-profile",
        json=payload,
        timeout=5
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
