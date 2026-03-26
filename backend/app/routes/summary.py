from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.models.encounter import Encounter, SOAPNote
from app.models.soap_summary import SOAPSummary
from app.modules.summary.soap_generator import soap_generator
from app.modules.ai.fusion import ai_fusion
from beanie import PydanticObjectId
import logging
from datetime import datetime

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

@router.post("/{encounter_id}/update")
async def update_soap(encounter_id: str, request_data: Dict):
    """Allows clinicians to override AI-generated SOAP notes, patient info, and billing with manual refinements."""
    try:
        from bson.objectid import ObjectId
        if not ObjectId.is_valid(encounter_id):
            encounter = await Encounter.find_one(Encounter.id == encounter_id)
        else:
            encounter = await Encounter.get(PydanticObjectId(encounter_id))
            
        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")
            
        # 1. Update encounter data from request
        # Support both direct SOAPNote objects or a wrapper with billing/patient info
        soap_raw = request_data.get("soap_note")
        if soap_raw:
            # If it's a dict, convert to SOAPNote object
            if isinstance(soap_raw, dict):
                encounter.soap_note = SOAPNote(**soap_raw)
            else:
                encounter.soap_note = soap_raw
        
        # Optional fields for manual billing/patient refinement
        if "billing_codes" in request_data:
            encounter.billing_codes = request_data["billing_codes"]
        if "patient_name" in request_data:
            encounter.patient_name = request_data["patient_name"]
            
        encounter.updated_at = datetime.utcnow()
    
        # 2. Re-trigger automation workflow based on REFINED data
        from app.modules.automation.billing_service import billing_service
        # Pass the memory-updated encounter object to avoid stale DB lookups
        billing_result = await billing_service.generate_claim(encounter_id, encounter.soap_note, encounter_obj=encounter)
        
        if billing_result.get("success"):
            encounter.invoice_id = billing_result.get("invoice_id")
            encounter.billing_codes = billing_result.get("billing_codes", encounter.billing_codes)
            encounter.billing_amount = billing_result.get("total_amount", 250.0) # Fallback to base fee
            encounter.billing_currency = billing_result.get("currency", "INR")
        else:
            # If billing service failed, at least set a base fee so it's not 0
            encounter.billing_amount = encounter.billing_amount or 250.0
        
        # EHR Sync re-trigger
        try:
            from app.modules.automation.fhir_service import fhir_service
            sync_result = await fhir_service.sync_encounter(encounter)
            if sync_result.get("success"):
                encounter.fhir_id = sync_result.get("fhir_id")
                encounter.fhir_status = "synced"
            else:
                encounter.fhir_status = "failed"
        except Exception as e:
            logger.error(f"EHR manual re-sync error: {e}")
            encounter.fhir_status = "failed"

        await encounter.save()
        return {
            "status": "success", 
            "message": "Clinician refinement saved & synced", 
            "billing_codes": encounter.billing_codes,
            "billing_amount": encounter.billing_amount,
            "billing_currency": encounter.billing_currency,
            "invoice_id": encounter.invoice_id
        }
    except Exception as e:
        logger.error(f"Failed to update SOAP/Billing: {e}")
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
