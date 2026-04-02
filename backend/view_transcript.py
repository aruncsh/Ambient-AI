
import motor.motor_asyncio
import asyncio
import json

async def q():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client.ambient_ai
    # Get last encounter
    encounter = await db.encounters.find_one(sort=[("created_at", -1)])
    if not encounter:
        print("No encounter")
        return
        
    print(f"ID: {encounter.get('_id')}")
    print("Transcript:")
    for line in encounter.get('transcript', []):
        print(f"  {line.get('speaker')}: {line.get('text')}")
    
    soap = encounter.get('soap_note', {})
    print("\nSOAP Subjective:", soap.get('subjective', 'EMPTY'))
    print("SOAP Clean Transcript:", soap.get('clean_transcript', 'EMPTY'))

if __name__ == "__main__":
    asyncio.run(q())
