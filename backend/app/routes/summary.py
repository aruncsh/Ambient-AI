from fastapi import APIRouter, HTTPException
from app.models.encounter import Encounter
from app.models.soap_summary import SOAPSummary
from app.modules.summary.soap_generator import soap_generator
from app.modules.ai.fusion import ai_fusion
from beanie import PydanticObjectId
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/{encounter_id}/generate")
async def generate_soap(encounter_id: str):
    try:
        from bson.objectid import ObjectId
        if not ObjectId.is_valid(encounter_id):
            # If not a valid ObjectId, search for it as a fallback (e.g. "demo") or return 404
            encounter = await Encounter.find_one(Encounter.id == encounter_id)
        else:
            encounter = await Encounter.get(PydanticObjectId(encounter_id))
    except Exception as e:
        logger.warning(f"Lookup failed for {encounter_id}: {e}")
        encounter = None
        
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
        
    # Process the entire accumulated transcript to generate a real SOAP note
    summary = await ai_fusion.generate_final_summary(encounter_id)
    return summary

@router.get("/{encounter_id}")
async def get_summary(encounter_id: str):
    return await SOAPSummary.find_one(SOAPSummary.encounter_id == encounter_id)

from pydantic import BaseModel

class TextToSoapRequest(BaseModel):
    text: str
    patient_id: str = "Anonymous"

@router.post("/text-to-soap")
async def text_to_soap(data: TextToSoapRequest):
    try:
        summary = await ai_fusion.generate_summary_from_text(data.text, data.patient_id)
        return summary
    except Exception as e:
        logger.error(f"Text-to-SOAP failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PreciseScribeRequest(BaseModel):
    input_text: str

@router.post("/precise-scribe")
async def precise_scribe(data: PreciseScribeRequest):
    try:
        from app.modules.ai.medical_nlp import medical_nlp_service
        result = await medical_nlp_service.process_precise_scribe(data.input_text)
        return result
    except Exception as e:
        logger.error(f"Precise Scribe failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))
