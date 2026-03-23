import asyncio
import httpx
import json
from datetime import datetime

async def test_ai_scribe_flow():
    base_url = "http://127.0.0.1:8001/api/v1"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Create Encounter
        print("1. Creating Encounter...")
        res = await client.post(f"{base_url}/encounters/", json={"patient_id": "P-999", "clinician_id": "DOC-777"})
        encounter = res.json()
        print(f"Raw encounter response: {encounter}")
        encounter_id = encounter.get("id") or encounter.get("_id")
        if isinstance(encounter_id, dict):
            encounter_id = encounter_id.get("$oid")
        print(f"Encounter ID: {encounter_id}")

        # 2. Simulate Audio Chunks (Transcribe)
        print("\n2. Simulating Audio Chunks...")
        chunks = [
            b"Hello doctor, I have a bad cough and some chest pain since yesterday.",
            b"I see, let's check your lungs. Any fever?",
            b"Yes, I felt a bit warm this morning. Also I'm very tired."
        ]
        
        for i, chunk in enumerate(chunks):
            files = {'file': ('chunk.webm', chunk, 'audio/webm')}
            res = await client.post(f"{base_url}/encounters/{encounter_id}/transcribe", files=files)
            print(f"Chunk {i+1} status: {res.status_code}")
            print(f"Transcript: {res.json().get('transcript')}")

        # 3. Generate SOAP Note
        print("\n3. Generating FINAL SOAP Note...")
        res = await client.post(f"{base_url}/summary/{encounter_id}/generate")
        print(f"Generate SOAP status: {res.status_code}")
        soap = res.json()
        if res.status_code != 200:
            print(f"Error generating SOAP: {soap}")
            return
            
        print(f"SOAP Subjective: {soap.get('subjective', '')[:50]}...")
        print(f"Extracted Symptoms: {soap.get('extracted_symptoms')}")

        # 4. Automation: FHIR Sync
        print("\n4. Triggering FHIR Sync...")
        res = await client.post(f"{base_url}/automation/fhir-sync/{encounter_id}")
        print(f"FHIR Sync: {res.json()}")

        # 5. Automation: Billing
        print("\n5. Triggering Billing Claim...")
        res = await client.post(f"{base_url}/automation/generate-claim/{encounter_id}")
        print(f"Billing Claim status: {res.status_code}")
        if res.status_code == 200:
            print(f"Billing Claim: {res.json()}")
        else:
            print(f"Error generating claim: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_ai_scribe_flow())
