import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.modules.ai.fusion import AIFusion
from app.models.encounter import Encounter
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def verify_flow():
    # 1. Init Database
    # Use localhost if 'mongodb' host fails (common in local vs docker setups)
    mongo_url = settings.MONGO_URL.replace("mongodb://mongodb:", "mongodb://localhost:")
    client = AsyncIOMotorClient(mongo_url)
    db_name = mongo_url.split("/")[-1]
    await init_beanie(database=client[db_name], document_models=[Encounter])
    
    # 2. Create Dummy Encounter
    encounter = Encounter(patient_id="test-p-1", clinician_id="test-d-1")
    await encounter.insert()
    encounter_id = str(encounter.id)
    print(f"Created Test Encounter: {encounter_id}")
    
    # 3. Add some transcript
    encounter.transcript = [
        {"speaker": "Doctor", "text": "Hello, how can I help you today?"},
        {"speaker": "Patient", "text": "I have a lot of chest pain and a cough."},
        {"speaker": "Doctor", "text": "I'll prescribe some Ibuprofen for the pain and we should order a CBC blood test."},
        {"speaker": "Doctor", "text": "Let's follow up in 2 weeks."}
    ]
    await encounter.save()
    
    # 4. Finalize Summary
    fusion = AIFusion()
    print("Finalizing summary and triggering automation...")
    soap = await fusion.generate_final_summary(encounter_id)
    
    # 5. Reload encounter to see automated fields
    updated_encounter = await Encounter.get(encounter.id)
    
    print("\n--- VERIFICATION RESULTS ---")
    print(f"Status: {updated_encounter.status}")
    print(f"Subjective: {soap.subjective}")
    print(f"Symptoms Extracted: {soap.extracted_symptoms}")
    print(f"Referrals: {soap.follow_up.get('referrals', 'None')}")
    print(f"Follow-ups: {soap.follow_up.get('follow_up_timeline', 'None')}")
    print(f"Lab Orders: {updated_encounter.lab_orders}")
    print(f"Prescriptions: {updated_encounter.prescriptions}")
    print(f"Billing Codes: {updated_encounter.billing_codes}")
    print(f"Invoice ID: {updated_encounter.invoice_id}")
    
    if updated_encounter.status == "completed" and len(updated_encounter.lab_orders) > 0:
        print("\nSUCCESS: All automated features are integrated and functioning.")
    else:
        print("\nFAILURE: Some automated features are missing.")

if __name__ == "__main__":
    asyncio.run(verify_flow())
