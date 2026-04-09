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
                logger.info(f"Creating virtual consult via CureSelect for appointment: {appointment.id}")
                
                # Construct clean payload to avoid Pydantic serialization issues
                consult_payload = {
                    "patient_id": appointment.patient_id,
                    "patient_name": appointment.patient_name,
                    "clinician_id": appointment.clinician_id,
                    "clinician_name": appointment.clinician_name,
                    "start_time": appointment.start_time,
                    "reason": appointment.reason,
                    "id": str(appointment.id)
                }
                consult_response = await cureselect_client.create_resource_consult(consult_payload)
                
                if consult_response and isinstance(consult_response, dict):
                    # Robust extraction of the consult data block from V3 response
                    data_block = consult_response.get("data", {})
                    consults_raw = data_block.get("consults") or data_block.get("consult")
                    
                    main_consult = {}
                    if isinstance(consults_raw, list) and len(consults_raw) > 0:
                        main_consult = consults_raw[0]
                    elif isinstance(consults_raw, dict):
                        main_consult = consults_raw
                    else:
                        main_consult = data_block if "id" in data_block else {}

                    consult_id = str(main_consult.get("id") or main_consult.get("consult_id") or "")
                    logger.info(f"Identified external consult ID: {consult_id}")

                    # If tokens are missing (happens on 201 Created), fetch the full consult
                    if not main_consult.get("participants") and consult_id:
                         logger.info(f"Tokens missing in creation response, fetching consult details for {consult_id}")
                         full_consult_res = await cureselect_client.fetch_by_id(consult_id)
                         if full_consult_res and isinstance(full_consult_res, dict):
                              data_block = full_consult_res.get("data", {})
                              consults_raw = data_block.get("consults") or data_block.get("consult")
                              if isinstance(consults_raw, list) and len(consults_raw) > 0:
                                   main_consult = consults_raw[0]
                              elif isinstance(consults_raw, dict):
                                   main_consult = consults_raw

                    # 2. Extract Publisher/Subscriber tokens for join links
                    publisher_token = None
                    subscriber_token = None
                    participants = main_consult.get("participants", [])
                    
                    if isinstance(participants, list):
                        for p in participants:
                            role = str(p.get("role", "")).lower()
                            if role == "publisher":
                                publisher_token = p.get("token")
                            elif role == "subscriber":
                                subscriber_token = p.get("token")

                    # 3. Store tokens and links in appointment metadata
                    doctor_base_url = "https://teleconsult.a2zhealth.in/teleconsult-v2/"
                    patient_base_url = "https://teleconsult.a2zhealth.in/consult/"
                    
                    if publisher_token:
                        appointment.teleconsult_link = f"{doctor_base_url}{publisher_token}?type=publisher"
                    
                    appointment.additional_info.update({
                        "external_id": consult_id,
                        "publisher_token": publisher_token,
                        "subscriber_token": subscriber_token,
                        "publisher_url": f"{doctor_base_url}{publisher_token}?type=publisher" if publisher_token else None,
                        "subscriber_url": f"{patient_base_url}{subscriber_token}" if subscriber_token else None
                    })
                    logger.info(f"Updated appointment additional_info with external links. ID: {consult_id}")
                else:
                    logger.warning(f"CureSelect consult creation returned no data or failed for appt {appointment.id}")

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
    appointment = await Appointment.get(PydanticObjectId(id))
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
    
    # Also delete/cancel the external consult if it exists
    external_id = appointment.additional_info.get("external_id")
    if external_id:
        logger.info(f"Canceling linked CureSelect consult: {external_id}")
        await cureselect_client.delete_consult(external_id)
        
    await appointment.delete()
    return {"status": "deleted"}
