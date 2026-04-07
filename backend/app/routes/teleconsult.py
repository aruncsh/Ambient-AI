from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from app.modules.consult_service import consult_service

router = APIRouter()

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
