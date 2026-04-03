from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.models.user import Patient, Doctor
from beanie import PydanticObjectId
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# Patient Endpoints
@router.get("/patients", response_model=List[Patient])
async def list_patients():
    return await Patient.find_all().to_list()

@router.post("/patients", response_model=Patient)
async def create_patient(patient: Patient):
    patient.created_at = datetime.utcnow()
    patient.updated_at = datetime.utcnow()
    await patient.insert()
    return patient

@router.get("/patients/{id}", response_model=Patient)
async def get_patient(id: str):
    if not PydanticObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    patient = await Patient.get(PydanticObjectId(id))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

# Doctor Endpoints
@router.get("/doctors", response_model=List[Doctor])
async def list_doctors():
    return await Doctor.find_all().to_list()

@router.post("/doctors", response_model=Doctor)
async def create_doctor(doctor: Doctor):
    doctor.created_at = datetime.utcnow()
    doctor.updated_at = datetime.utcnow()
    await doctor.insert()
    return doctor

@router.get("/doctors/{id}", response_model=Doctor)
async def get_doctor(id: str):
    if not PydanticObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    doctor = await Doctor.get(PydanticObjectId(id))
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor
