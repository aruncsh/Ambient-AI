
import asyncio
from app.models.encounter import Encounter, SOAPNote
from app.modules.ai.fusion import ai_fusion
import motor.motor_asyncio
from beanie import init_beanie
from app.core.config import settings

async def reproduce():
    # Initialize Beanie with a mock/temp DB if needed, but here we just want to test object creation
    e = Encounter(patient_id="test", clinician_id="test")
    print(f"Transcript type: {type(e.transcript)}")
    print(f"Transcript value: {e.transcript}")
    try:
        e.transcript.append({"speaker": "Doctor", "text": "Hello", "timestamp": "now"})
        print("Append to transcript successful")
        print(f"Transcript now: {e.transcript}")
    except Exception as err:
        print(f"Append to transcript failed: {err}")

    # Test the actual fusion method (mocking the NLP calls if possible)
    # But first, let's see if the object creation is the issue
    
if __name__ == "__main__":
    asyncio.run(reproduce())
