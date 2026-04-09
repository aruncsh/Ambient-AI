from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from app.modules.consult_service import consult_service
from pydantic import BaseModel

router = APIRouter()

class EndConsultRequest(BaseModel):
    consult_notes: Optional[str] = None

class EventRequest(BaseModel):
    event: str

class InviteRequest(BaseModel):
    invites: List[Dict[str, Any]]

class PtzCameraRequest(BaseModel):
    consultId: str
    action: str
    speed: str

class SwitchProviderRequest(BaseModel):
    virtual_service_provider: str

@router.get("/token-validate")
async def token_validate(token: str = Query(...)):
    result = await consult_service.token_validate(token)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result

@router.get("/summary")
async def consult_summary(token: str = Query(...)):
    result = await consult_service.get_consult_summary(token)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.get("/list")
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
    
    # PHP logic: if hospital/group, filter by participants
    # For now, we pass all query params as filters
    return await consult_service.fetch_consults(filters, limit, page)

@router.get("/count-by-status")
async def get_consult_count_by_status(
    request: Request,
    consult_status: List[str] = Query(...),
    participant_ref_number: Optional[str] = None,
    scheduled_from_date: Optional[str] = None,
    scheduled_to_date: Optional[str] = None,
    consult_type: Optional[str] = None,
    consult_id: Optional[str] = None,
    organization_id: Optional[str] = None
):
    filters = {}
    if participant_ref_number: filters["participant_ref_number"] = participant_ref_number
    if scheduled_from_date: filters["scheduled_from_date"] = scheduled_from_date
    if scheduled_to_date: filters["scheduled_to_date"] = scheduled_to_date
    if consult_type: filters["consult_type"] = consult_type
    if consult_id: filters["consult_id"] = consult_id
    if organization_id: filters["organization_id"] = organization_id
    
    return await consult_service.get_consult_count_by_status(consult_status, filters)


@router.get("/{id}/{role}/{participantId}")
async def fetch_consult(id: str, role: str, participantId: str):
    result = await consult_service.fetch_consult(id, role, participantId)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.patch("/{id}/{role}/{participantId}/start")
async def start_consult(id: str, role: str, participantId: str):
    return await consult_service.start_consult(id, role, participantId)

@router.patch("/{id}/{role}/{participantId}/end")
async def end_consult(id: str, role: str, participantId: str, req: EndConsultRequest):
    return await consult_service.end_consult(id, role, participantId, req.consult_notes)

@router.post("/{id}/{role}/{participantId}/event")
async def consult_event(id: str, role: str, participantId: str, req: EventRequest):
    return await consult_service.handle_event(id, role, participantId, req.event)

@router.patch("/{id}/{role}/{participantId}/invite")
async def consult_invite(id: str, role: str, participantId: str, req: InviteRequest):
    return await consult_service.invite_guests(id, role, participantId, req.invites)

@router.patch("/{id}/{role}/{participantId}/switch")
async def consult_switch(id: str, role: str, participantId: str, req: SwitchProviderRequest):
    return await consult_service.switch_provider(id, role, participantId, req.virtual_service_provider)

@router.post("/adjust-ptz-camera")
async def ptz_camera_access(req: PtzCameraRequest):
    result = await consult_service.ptz_camera_access(req.consultId, req.action, req.speed)
    if "error" in result:
         raise HTTPException(status_code=400, detail=result["error"])
    return result

