"""
AutismCare Behavioural Intelligence API - Live Demo
"""
import requests
import json
from datetime import datetime, timedelta
import numpy as np

BASE_URL = 'http://localhost:8001'

def run_demo():
    print('='*60)
    print('AutismCare Behavioural Intelligence API - Live Demo')
    print('='*60)

    # 1. Health check
    print('\n1. Health Check')
    resp = requests.get(f'{BASE_URL}/health')
    health = resp.json()
    print(f'   Status: {health["status"]}')
    print(f'   Anomaly Model: {health["config"]["anomaly_model"]}')

    # 2. Initialize with sample data
    print('\n2. Initializing child with 30 days of data...')
    np.random.seed(42)

    historical_data = []
    for day in range(30):
        date = (datetime.now() - timedelta(days=30-day)).strftime('%Y-%m-%d')
        historical_data.append({
            'date': date,
            'sleep_hours': round(np.random.normal(8, 1), 2),
            'activity_level': round(np.random.uniform(0.3, 0.7), 3),
            'emotion_score': round(np.random.uniform(0.4, 0.8), 3),
            'behaviour_score': round(np.random.uniform(0.4, 0.7), 3),
            'medication_flag': int(np.random.randint(0, 2))
        })

    init_resp = requests.post(
        f'{BASE_URL}/initialize',
        json={'child_id': 'demo_child_001', 'historical_data': historical_data}
    )
    init_result = init_resp.json()
    print(f'   Status: {init_result["status"]}')
    print(f'   Models fitted: {init_result.get("models_fitted", [])}')

    # 3. Get baseline
    print('\n3. Getting personalized baseline...')
    baseline_resp = requests.get(f'{BASE_URL}/baseline/demo_child_001')
    baseline = baseline_resp.json()
    print(f'   Sleep baseline: {baseline["baseline_sleep"]} hours')
    print(f'   Activity baseline: {baseline["baseline_activity"]}')
    print(f'   Behavior baseline: {baseline["baseline_behaviour"]}')
    print(f'   Confidence: {baseline["confidence"]*100:.0f}%')

    # 4. Analyze today's entry (with low sleep - should trigger concern)
    print('\n4. Analyzing today with LOW SLEEP (potential anomaly)...')
    analysis_resp = requests.post(
        f'{BASE_URL}/analyze',
        json={
            'child_id': 'demo_child_001',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'sleep_start': '23:30',
            'sleep_end': '05:30',  # Only 6 hours - less than baseline
            'emotions': ['anxious', 'irritable'],
            'behaviour_intensity': 'moderate',
            'behaviour_notes': 'Seemed tired and a bit restless today',
            'language': 'en'
        }
    )
    result = analysis_resp.json()
    
    print('\n   ' + '-'*50)
    print('   ANALYSIS RESULT (API Response Format):')
    print('   ' + '-'*50)
    print(f'   anomaly_score: {result["anomaly_score"]}')
    print(f'   confidence: {result["confidence"]}%')
    print(f'   forecast: {result["forecast"]}')
    print(f'   explanation: {result["explanation"]}')
    if result.get('contributing_factors'):
        print('   contributing_factors:')
        for factor in result['contributing_factors'][:3]:
            print(f'     - {factor}')
    print('   ' + '-'*50)

    # 5. Get correlation insights
    print('\n5. Getting correlation analysis...')
    corr_resp = requests.get(f'{BASE_URL}/correlation/demo_child_001')
    corr = corr_resp.json()
    print(f'   Model type: {corr["model_type"]}')
    print(f'   R-squared: {corr["r_squared"]:.3f}')
    print(f'   Top influencing factor: {corr["top_influencing_factor"]}')
    print(f'   Summary: {corr["summary_explanation"]}')

    # 6. Get ethics disclaimer
    print('\n6. Ethics Compliance')
    ethics_resp = requests.get(f'{BASE_URL}/ethics/disclaimer')
    ethics = ethics_resp.json()
    print(f'   Non-diagnostic: {ethics["rules"]["non_diagnostic"]}')
    print(f'   Probability-based: {ethics["rules"]["probability_based"]}')
    print(f'   Explainability always on: {ethics["rules"]["explainability_always_on"]}')

    print('\n' + '='*60)
    print('API Demo Complete!')
    print('='*60)
    print('\nAPI Endpoints:')
    print('  - http://localhost:8001/docs (Swagger UI)')
    print('  - http://localhost:8001/health')
    print('  - POST http://localhost:8001/initialize')
    print('  - POST http://localhost:8001/analyze')
    print('  - GET http://localhost:8001/baseline/{child_id}')
    print('  - GET http://localhost:8001/correlation/{child_id}')
    print('  - POST http://localhost:8001/forecast/{child_id}')

if __name__ == '__main__':
    run_demo()
