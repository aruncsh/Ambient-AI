from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from app.modules.consult_service import consult_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/token-validate")
async def token_validate(token: str = Query(...)):
    result = await consult_service.token_validate(token)
    if "error" in result:
        # Diagnostic: print the traceback to console as well
        if "traceback" in result:
             print(result["traceback"])
        raise HTTPException(status_code=401, detail=f"{result['error']} - Trace: {result.get('traceback', 'No trace')[:200]}")
    return result

@router.get("/summary")
async def consult_summary(token: str = Query(...)):
    result = await consult_service.get_consult_summary(token)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.post("/end")
async def end_consult(token: str = Query(...), notes: Optional[str] = None):
    # 1. Identify participant from token
    info = await consult_service.get_consult_info(token)
    if "error" in info:
        raise HTTPException(status_code=401, detail=info["error"])
    
    # 2. Call microservice end
    consult_id = info["consult_id"]
    role_info = info["provider_info"] # This has the role and ID of the caller
    role = role_info.get("role")
    participant_id = role_info.get("id")
    
    if not consult_id or not role or not participant_id:
        raise HTTPException(status_code=400, detail="Incomplete consult metadata for ending session.")

    logger.info(f"Ending consult {consult_id} for {role} {participant_id}")
    result = await consult_service.end_consult(consult_id, role, participant_id, notes)
    return result
