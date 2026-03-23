from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.scheduling import Appointment
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[Appointment])
async def list_appointments(patient_id: Optional[str] = None, clinician_id: Optional[str] = None):
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if clinician_id:
        query["clinician_id"] = clinician_id
    return await Appointment.find(query).to_list()

@router.post("/", response_model=Appointment)
async def create_appointment(appointment: Appointment):
    await appointment.insert()
    return appointment

@router.patch("/{id}", response_model=Appointment)
async def update_appointment_status(id: str, status: str):
    appointment = await Appointment.get(id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appointment.status = status
    await appointment.save()
    return appointment
