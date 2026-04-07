from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.scheduling import Appointment
from datetime import datetime
from beanie import PydanticObjectId
from app.modules.cureselect import cureselect_client
from app.models.consult import Consult, ConsultParticipant
import secrets
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[Appointment])
async def list_appointments(patient_id: Optional[str] = None, clinician_id: Optional[str] = None):
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if clinician_id:
        query["clinician_id"] = clinician_id
    return await Appointment.find(query).sort("+start_time").to_list()

@router.post("/", response_model=Appointment)
async def create_appointment(appointment: Appointment):
    await appointment.insert() 
    
    if appointment.type == "Virtual":
                # 1. Create External Consult via Microservice
                consult_response = await cureselect_client.create_resource_consult(appointment.dict())
                
                if consult_response and isinstance(consult_response, dict):
                    # The microservice returns 'consult_id' or 'id'
                    consult_data = consult_response.get("data", {}) or consult_response
                    # The microservice returns 'consult_id' or 'id' inside 'data.consults[0]'
                    consults = consult_data.get("consults", [])
                    main_consult = consults[0] if consults else (consult_data if "id" in consult_data else {})
                    consult_id = str(main_consult.get("id") or consult_data.get("consult_id") or consult_data.get("id"))
                    
                    # Store microservice ID and link
                    # Try to find publisher token for the link if direct link not provided
                    publisher_token = None
                    participants = main_consult.get("participants", [])
                    for p in participants:
                        if p.get("role") == "publisher":
                            publisher_token = p.get("token")
                            break
                    
                    ext_link = consult_response.get("consult_link") or consult_response.get("link")
                    if publisher_token:
                        appointment.teleconsult_link = f"https://services-api.a2zhealth.in/consult/{publisher_token}"
                    elif ext_link:
                        appointment.teleconsult_link = ext_link
                    elif consult_id:
                        appointment.teleconsult_link = f"https://services-api.a2zhealth.in/consult/{consult_id}"
                    
                    # Keep record of external ID for Ambient AI sync
                    if consult_id:
                        appointment.additional_info["external_id"] = consult_id
                        if participants:
                            appointment.additional_info["participants"] = participants
                
                await appointment.save()
    
    return appointment

@router.get("/{id}", response_model=Appointment)
async def get_appointment(id: str):
    appointment = await Appointment.get(PydanticObjectId(id))
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@router.patch("/{id}", response_model=Appointment)
async def update_appointment_status(id: str, status: str):
    appointment = await Appointment.get(id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = status
    await appointment.save()
    return appointment

@router.delete("/{id}")
async def delete_appointment(id: str):
    appointment = await Appointment.get(PydanticObjectId(id))
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await appointment.delete()
    return {"status": "deleted"}
