from fastapi import APIRouter, Body
from app.modules.consent.consent_flow import consent_flow

router = APIRouter()

@router.post("/{encounter_id}")
async def record_consent(encounter_id: str, type: str = Body(...), data: str = Body(...)):
    return await consent_flow.record_consent(encounter_id, type, data)
