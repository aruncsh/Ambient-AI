import requests
import json

try:
    resp = requests.get("http://127.0.0.1:8001/api/v1/users/patients")
    if resp.status_code == 200:
        patients = resp.json()
        print(f"Total Patients: {len(patients)}")
        for p in patients[:5]:
            print(f"ID: {p.get('_id')}, Name: {p.get('name')}")
except Exception as e:
    print(f"Error: {e}")
