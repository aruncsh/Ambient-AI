import asyncio
import os
import io
import wave
from app.modules.ai.fusion import ai_fusion
from app.models.encounter import Encounter
from app.core.config import settings
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

async def test_batch_flow():
    # 1. Setup DB
    client = AsyncIOMotorClient(settings.MONGO_URL)
    await init_beanie(database=client.get_default_database(), document_models=[Encounter])
    
    # 2. Create a mock encounter
    enc = await Encounter(patient_id="Test Patient", clinician_id="Test Doc").insert()
    encounter_id = str(enc.id)
    print(f"Created Test Encounter: {encounter_id}")
    
    # 3. Use an existing recording to simulate upload
    recording_dir = os.path.join(os.getcwd(), "recordings")
    files = [f for f in os.listdir(recording_dir) if f.endswith(".wav")]
    if not files:
        print("No recordings found to test with.")
        return
    
    with open(os.path.join(recording_dir, files[0]), "rb") as f:
        audio_data = f.read()
    
    print(f"Uploading {len(audio_data)} bytes of audio to simulate batch process...")
    
    # 4. Trigger process_final_batch
    updated_enc = await ai_fusion.process_final_batch(encounter_id, audio_data)
    
    if updated_enc:
        print(f"Batch process complete. Status: {updated_enc.status}")
        print(f"Transcript entries: {len(updated_enc.transcript)}")
        if updated_enc.transcript:
            print(f"First line: {updated_enc.transcript[0]['text']}")
            print(f"Timestamp: {updated_enc.transcript[0]['timestamp']}")
        
        if updated_enc.soap_note:
            print(f"SOAP Note generated: {updated_enc.soap_note.subjective[:50]}...")
    else:
        print("Batch processing returned None.")

if __name__ == "__main__":
    asyncio.run(test_batch_flow())
