from fastapi import APIRouter, HTTPException, UploadFile, File, Body, Response
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Optional
from app.models.encounter import Encounter
from app.modules.ai.whisper import whisper_service
from app.core.config import settings
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def list_encounters():
    try:
        from app.models.encounter import Encounter
        return await Encounter.find_all().sort("-created_at").to_list()
    except Exception as e:
        logger.error(f"Error listing encounters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{encounter_id}")
async def get_encounter(encounter_id: str):
    try:
        from beanie import PydanticObjectId
        from bson.errors import InvalidId
        
        # Check if ID is a valid ObjectId
        # Try finding in database first, even for "demo" or "1"
        encounter = None
        try:
            if encounter_id in ["1", "2", "3"] or encounter_id.startswith("mock-") or encounter_id == "demo":
                # Check for custom ID match
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            
            if not encounter:
                obj_id = PydanticObjectId(encounter_id)
                encounter = await Encounter.get(obj_id)
        except (InvalidId, ValueError):
            logger.warning(f"Invalid ObjectId format: {encounter_id}, attempting mock lookup.")
            
        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")

        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")
        return encounter
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error fetching encounter: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{encounter_id}/reset")
async def reset_encounter(encounter_id: str):
    from beanie import PydanticObjectId
    from bson.objectid import ObjectId
    try:
        if not ObjectId.is_valid(encounter_id):
            encounter = await Encounter.find_one(Encounter.id == encounter_id)
        else:
            encounter = await Encounter.get(PydanticObjectId(encounter_id))
        
        if encounter:
            encounter.transcript = []
            encounter.soap_note = None
            encounter.emotions = []
            encounter.lab_orders = []
            encounter.prescriptions = []
            encounter.billing_codes = []
            import os
            if encounter.recording_path and os.path.exists(encounter.recording_path):
                try: os.unlink(encounter.recording_path)
                except: pass
                # Also try to clean up wav conversion if it exists
                wav_path = encounter.recording_path.replace(".webm", ".wav")
                if os.path.exists(wav_path):
                    try: os.unlink(wav_path)
                    except: pass
                encounter.recording_path = None
            await encounter.save()
            return {"status": "success", "message": "Encounter reset"}
        return {"status": "ignored"}
    except Exception as e:
        logger.error(f"Reset failed: {e}")
        return {"status": "error", "message": str(e)}

from pydantic import BaseModel

class EncounterCreate(BaseModel):
    patient_id: str = "Anonymous"
    patient_name: Optional[str] = "Anonymous Patient"
    clinician_id: str = "System"
    consent_obtained: bool = False

@router.post("/")
async def create_encounter(data: EncounterCreate):
    try:
        encounter = await Encounter(
            patient_id=data.patient_id, 
            patient_name=data.patient_name, 
            clinician_id=data.clinician_id,
            consent_obtained=data.consent_obtained
        ).insert()

        # Update patient consent record if patient_id is valid and consent obtained
        if data.consent_obtained and data.patient_id and data.patient_id != "Anonymous":
            from app.models.user import Patient
            from beanie import PydanticObjectId
            from bson.objectid import ObjectId
            try:
                if ObjectId.is_valid(data.patient_id):
                    patient = await Patient.get(PydanticObjectId(data.patient_id))
                    if patient:
                        patient.is_consent_given = True
                        await patient.save()
            except Exception as e:
                logger.error(f"Failed to update patient consent: {e}")

        return encounter
    except Exception as e:
        logger.error(f"Encounter creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/emergency")
async def create_emergency_encounter():
    try:
        encounter = await Encounter(
            patient_id="Emergency", 
            patient_name="Emergency Patient", 
            clinician_id="ER Doctor",
            consent_obtained=True, # Implicit in emergency
            is_emergency=True,
            registration_status="pending"
        ).insert()
        return encounter
    except Exception as e:
        logger.error(f"Emergency encounter creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{encounter_id}/demographics")
async def update_encounter_demographics(encounter_id: str, demographics: dict = Body(...)):
    from beanie import PydanticObjectId
    from bson.objectid import ObjectId
    try:
        if not ObjectId.is_valid(encounter_id):
            encounter = await Encounter.find_one(Encounter.id == encounter_id)
        else:
            encounter = await Encounter.get(PydanticObjectId(encounter_id))
        
        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")
        
        # Explicitly check for special fields like patient_id and registration_status
        if "patient_id" in demographics:
            encounter.patient_id = demographics.pop("patient_id")
        if "registration_status" in demographics:
            encounter.registration_status = demographics.pop("registration_status")
        
        # Merge remaining demographics
        current = encounter.current_demographics or {}
        current.update(demographics)
        encounter.current_demographics = current
        
        # If already registered a new patient, sync to patient record too
        if encounter.patient_id and encounter.patient_id != "Emergency" and encounter.registration_status == "new":
            from app.models.user import Patient
            patient = await Patient.get(PydanticObjectId(encounter.patient_id))
            if patient:
                allowed_fields = ["name", "email", "phone", "date_of_birth", "gender", "blood_group", "address", "medical_history", "allergies"]
                for k, v in demographics.items():
                    if k in allowed_fields:
                        setattr(patient, k, v)
                await patient.save()
        
        await encounter.save()
        return {"status": "success", "demographics": encounter.current_demographics}
    except Exception as e:
        logger.error(f"Demographics update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{encounter_id}/transcribe")
async def transcribe_audio(encounter_id: str, file: UploadFile = File(...), live: bool = False):
    """
    Receives an audio chunk via REST and returns the transcript.
    """
    try:
        audio_data = await file.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Empty audio data")
            
        from app.modules.ai.fusion import ai_fusion
        from beanie import PydanticObjectId
        from bson.objectid import ObjectId
        
        # 0. Enforce Consent check at API level
        try:
            if not ObjectId.is_valid(encounter_id):
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter = await Encounter.get(PydanticObjectId(encounter_id))
            
            if encounter and not encounter.consent_obtained:
                raise HTTPException(status_code=403, detail={"error": "Patient consent required before recording can begin"})
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            logger.error(f"Consent check failed: {e}")

        # Process via AI Fusion to handle persistence and multi-modal integration
        result = await ai_fusion.process_encounter_stream(
            encounter_id=encounter_id,
            audio_chunk=audio_data,
            live=live
        )
        
        return result
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{encounter_id}/stop")
async def stop_recording(encounter_id: str, file: UploadFile = File(None)):
    """
    Finalizes the encounter recording and triggers batch transcription.
    Optionally accepts the full audio file from the client.
    """
    try:
        from app.modules.ai.fusion import ai_fusion
        from beanie import PydanticObjectId
        from bson.objectid import ObjectId
        
        # Enforce Consent check
        try:
            if not ObjectId.is_valid(encounter_id):
                encounter_doc = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter_doc = await Encounter.get(PydanticObjectId(encounter_id))
            
            if encounter_doc and not encounter_doc.consent_obtained:
                raise HTTPException(status_code=403, detail={"error": "Patient consent required before recording can begin"})
        except Exception as e:
            if isinstance(e, HTTPException): raise e

        if file:
            audio_data = await file.read()
            encounter = await ai_fusion.process_final_batch(encounter_id, audio_data)
        else:
            # Fallback for when audio was streamed during session (silent mode)
            await ai_fusion.batch_process_encounter(encounter_id)
            # Ensure SOAP note and insights are generated after batch transcription
            await ai_fusion.generate_final_summary(encounter_id)
            
            from beanie import PydanticObjectId
            from bson.objectid import ObjectId
            if not ObjectId.is_valid(encounter_id):
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter = await Encounter.get(PydanticObjectId(encounter_id))
            
        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")
            
        return encounter
    except Exception as e:
        logger.error(f"Stop recording error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{encounter_id}/prescription-pdf")
async def get_prescription_pdf(encounter_id: str):
    from beanie import PydanticObjectId
    from bson.objectid import ObjectId
    
    if not ObjectId.is_valid(encounter_id):
        encounter = await Encounter.find_one(Encounter.id == encounter_id)
    else:
        encounter = await Encounter.get(PydanticObjectId(encounter_id))
        
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    
    from app.modules.automation.pdf_service import pdf_service
    clinician_name = encounter.clinician_id or "Medical Provider"
    patient_name = encounter.patient_name or "Valued Patient"
    
    filename = pdf_service.generate_prescription_pdf(
        encounter_id=str(encounter.id),
        clinician_name=clinician_name,
        patient_name=patient_name,
        prescriptions=encounter.prescriptions or []
    )
    
    if not filename:
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
    
    filepath = os.path.join(os.getcwd(), "attachments", filename)
    return FileResponse(filepath, media_type='application/pdf', filename=filename)
