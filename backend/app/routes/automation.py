from fastapi import APIRouter, HTTPException
from app.modules.automation.fhir_service import fhir_service
from app.modules.automation.twilio_service import twilio_service
from app.modules.automation.billing_service import billing_service
from app.models.encounter import Encounter
from beanie import PydanticObjectId

router = APIRouter()

@router.post("/fhir-sync/{encounter_id}")
async def sync_fhir(encounter_id: str):
    try:
        encounter = await Encounter.get(PydanticObjectId(encounter_id))
    except:
        encounter = None
        
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return await fhir_service.sync_encounter(encounter)

@router.post("/send-reminder")
async def send_reminder(phone: str, msg: str):
    return await twilio_service.send_notification(phone, msg)

@router.post("/generate-claim/{encounter_id}")
async def generate_billing(encounter_id: str):
    try:
        encounter = await Encounter.get(PydanticObjectId(encounter_id))
    except:
        encounter = None
        
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
        
    return await billing_service.generate_claim(encounter_id, encounter.soap_note)
