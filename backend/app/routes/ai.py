from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class SuggestRequest(BaseModel):
    transcript: str


class ExtractDemographicsRequest(BaseModel):
    text: str
    fast: Optional[bool] = False


@router.post("/chat")
async def general_chat(data: ChatRequest):
    """
    General-purpose AI chat endpoint. Free to use via local Ollama.
    Handles medical and non-medical queries with optional conversation history.
    """
    try:
        from app.modules.ai.clinical_assistant import clinical_assistant_service
        history = [{"role": m.role, "content": m.content} for m in (data.history or [])]
        reply = await clinical_assistant_service.general_chat(data.message, history)
        return {"reply": reply}
    except Exception as e:
        logger.error(f"General chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest")
async def get_clinical_suggestions(data: SuggestRequest):
    """
    Returns real-time clinical suggestions (differentials, questions, red flags)
    based on the current encounter transcript. Works free via local Ollama.
    """
    try:
        from app.modules.ai.clinical_assistant import clinical_assistant_service
        suggestions = await clinical_assistant_service.get_clinical_suggestions(data.transcript)
        return suggestions
    except Exception as e:
        logger.error(f"Clinical suggestions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-demographics")
async def extract_demographics(data: ExtractDemographicsRequest):
    """
    Extracts patient demographics from a given text string.
    Useful for voice-assisted form filling.
    """
    try:
        from app.modules.ai.medical_nlp import medical_nlp_service
        demographics = await medical_nlp_service.extract_demographics(data.text, fast=data.fast)
        return demographics
    except Exception as e:
        logger.error(f"Demographics extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def ai_status():
    """Returns the current AI backend status (OpenAI, Groq, or Ollama)."""
    from app.core.config import settings
    import httpx

    backend = "none"
    model = "N/A"
    ollama_available = False

    if settings.OPENAI_API_KEY:
        backend = "openai"
        model = settings.OPENAI_API_MODEL or "gpt-3.5-turbo"
    elif settings.GROQ_API_KEY:
        backend = "groq"
        model = "llama-3.1-70b-versatile"

    # Always check if Ollama is running locally
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_URL.rstrip('/api/generate').rstrip('/api/chat')}/api/tags")
            if resp.status_code == 200:
                ollama_available = True
                if backend == "none":
                    backend = "ollama"
                    model = settings.OLLAMA_MODEL or "llama3"
    except Exception:
        pass

    return {
        "backend": backend,
        "model": model,
        "ollama_available": ollama_available,
        "free_mode": backend in ("ollama", "none"),
        "status": "active" if backend != "none" else "limited"
    }
