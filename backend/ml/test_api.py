 
import requests
import json

url = "http://localhost:8001/initialize_raw"
data = {
    "child_id": "test_child",
    "routine_entries": [
        {"child_id": "test_child", "date": "2024-01-01", "type": "sleep", "start_time": "21:00", "end_time": "07:00"},
        {"child_id": "test_child", "date": "2024-01-02", "type": "sleep", "start_time": "21:00", "end_time": "07:00"},
        {"child_id": "test_child", "date": "2024-01-03", "type": "sleep", "start_time": "21:00", "end_time": "07:00"},
        {"child_id": "test_child", "date": "2024-01-04", "type": "sleep", "start_time": "21:00", "end_time": "07:00"},
        {"child_id": "test_child", "date": "2024-01-05", "type": "sleep", "start_time": "21:00", "end_time": "07:00"},
        {"child_id": "test_child", "date": "2024-01-06", "type": "sleep", "start_time": "21:00", "end_time": "07:00"},
        {"child_id": "test_child", "date": "2024-01-07", "type": "sleep", "start_time": "21:00", "end_time": "07:00"}
    ],
    "behavior_entries": [
        {"child_id": "test_child", "date": "2024-01-01", "emotion": "happy", "intensity": "low"},
        {"child_id": "test_child", "date": "2024-01-02", "emotion": "happy", "intensity": "low"},
        {"child_id": "test_child", "date": "2024-01-03", "emotion": "happy", "intensity": "low"},
        {"child_id": "test_child", "date": "2024-01-04", "emotion": "happy", "intensity": "low"},
        {"child_id": "test_child", "date": "2024-01-05", "emotion": "happy", "intensity": "low"},
        {"child_id": "test_child", "date": "2024-01-06", "emotion": "happy", "intensity": "low"},
        {"child_id": "test_child", "date": "2024-01-07", "emotion": "happy", "intensity": "low"}
    ]
}


try:
    with open("test_output.txt", "w") as f:
        f.write(f"Sending request to {url}...\n")
        response = requests.post(url, json=data)
        f.write(f"Status Code: {response.status_code}\n")
        f.write(f"Response: {response.text}\n")
        
        if response.status_code == 200:
            f.write("SUCCESS: Endpoint works!\n")
        else:
            f.write("FAILURE: Endpoint returned error.\n")

except Exception as e:
    with open("test_output.txt", "w") as f:
        f.write(f"ERROR: {e}\n")
