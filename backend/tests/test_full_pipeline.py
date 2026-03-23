
import asyncio
import json
from app.modules.ai.fusion import ai_fusion

async def verify_full_pipeline():
    print("Verifying Full Automation Pipeline (Internal)...")
    
    text = "Doctor: Hello. Patient: I have severe chest pain. Doctor: Your blood pressure is 150/95. I will order an ECG and prescribe aspirin."
    
    print("\n--- Running generate_summary_from_text ---")
    result = await ai_fusion.generate_summary_from_text(text, "test-patient-123")
    
    print("\nRESULT:")
    # print(json.dumps(result, indent=2, default=str)) # Use default=str for datetime/ObjectId
    
    # Check that it didn't crash
    assert result["soap_note"] is not None
    assert result["encounter_id"] is not None
    
    # Check that the SOAP note fields are dictionaries/objects (as per new model)
    soap = result["soap_note"]
    print(f"Subjective type: {type(soap.subjective)}")
    
    # Check that lab orders were generated despite nested plan
    # (Checking against the encounter is better)
    from app.models.encounter import Encounter
    from beanie import PydanticObjectId
    encounter = await Encounter.get(PydanticObjectId(result["encounter_id"]))
    
    print(f"Lab Orders: {encounter.lab_orders}")
    assert len(encounter.lab_orders) > 0
    assert "12-Lead ECG" in encounter.lab_orders or "ECG" in str(encounter.lab_orders)
    
    print(f"Prescriptions: {encounter.prescriptions}")
    assert len(encounter.prescriptions) > 0
    
    print("\nSUCCESS: Full pipeline verified with advanced structured data.")

if __name__ == "__main__":
    # We need to initialize the DB first because fusion.py uses database
    import motor.motor_asyncio
    from beanie import init_beanie
    from app.models.encounter import Encounter
    from app.core.config import settings
    
    async def main():
        client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGO_URL)
        await init_beanie(database=client.get_default_database(), document_models=[Encounter])
        await verify_full_pipeline()
        
    asyncio.run(main())
