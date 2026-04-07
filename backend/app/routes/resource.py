from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from app.modules.consult_service import consult_service
from pydantic import BaseModel

router = APIRouter()

@router.get("/consults")
async def list_consults(
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    consult_status: Optional[str] = None,
    consult_id: Optional[str] = None,
    page: int = 1,
    limit: int = 15
):
    filters = {}
    if from_date:
         filters["from_date"] = from_date
    if to_date:
         filters["to_date"] = to_date
    if consult_status:
         filters["consult_status"] = consult_status
    if consult_id:
         filters["consult_id"] = consult_id
    
    return await consult_service.fetch_consults(filters, limit, page)

class CreateConsultRequest(BaseModel):
    # This matches the PHP createModel payload
    patient_id: str
    clinician_id: str
    start_time: Optional[str] = None
    reason: Optional[str] = None
    speciality: Optional[str] = "General"
    cart_camera: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None

@router.post("/consults")
async def create_consult(req: CreateConsultRequest):
    # Use the logic from scheduling.py / Consult.createModel
    from app.modules.cureselect import cureselect_client
    result = await cureselect_client.create_resource_consult(req.dict())
    if not result:
         raise HTTPException(status_code=500, detail="Failed to create consult on external service")
    return result

@router.patch("/consults/{id}")
async def update_consult(id: str, request: Request):
    # PHP logic: update status and call patch
    data = await request.json()
    data["id"] = id
    from app.modules.cureselect import cureselect_client
    result = await cureselect_client.patch_consult(data)
    if not result:
         raise HTTPException(status_code=500, detail="Failed to update consult on external service")
    return result
