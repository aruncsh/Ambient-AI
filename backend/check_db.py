
import motor.motor_asyncio
import asyncio
import json
from datetime import datetime

async def check_last_encounter():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client.ambient_ai
    # Get last encounter
    encounter = await db.encounters.find_one(sort=[("created_at", -1)])
    if not encounter:
        print("No encounters found.")
        return

    print(f"--- Encounter: {encounter.get('_id')} ---")
    print(f"Status: {encounter.get('status')}")
    print(f"Transcript lines: {len(encounter.get('transcript', []))}")
    
    soap = encounter.get('soap_note', {})
    print(f"SOAP Assessment (Diagnostic): {soap.get('assessment', {}).get('primary_diagnosis', 'EMPTY')}")
    print(f"Clean Transcript Length: {len(soap.get('clean_transcript', ''))}")
    
    # Check for errors in some of the most recent lines
    with open("uvicorn.log", "r") as f:
        lines = f.readlines()
        print("\n--- Last 20 lines of uvicorn.log ---")
        for line in lines[-20:]:
            print(line.strip())

if __name__ == "__main__":
    asyncio.run(check_last_encounter())
