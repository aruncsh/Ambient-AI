from fastapi import FastAPI, Request, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.mongodb import init_db
from app.routes import encounters, summary, automation, consent, scheduling, billing, ai
from app.core.audit_log import audit_log_middleware
from app.core.retention import retention_worker
from contextlib import asynccontextmanager
import asyncio
import json

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize MongoDB
    await init_db()
    # Start retention worker
    asyncio.create_task(retention_worker())
    # Warmup AI models
    from app.modules.ai.whisper import whisper_service
    whisper_service.warmup()
    yield

app = FastAPI(
    title="Ambient AI Scribe",
    version="2.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_audit_log(request: Request, call_next):
    return await audit_log_middleware(request, call_next)

# Routes
app.include_router(encounters, prefix="/api/v1/encounters", tags=["Encounters"])
app.include_router(summary, prefix="/api/v1/summary", tags=["Summaries"])
app.include_router(automation, prefix="/api/v1/automation", tags=["Automation"])
app.include_router(consent, prefix="/api/v1/consent", tags=["Consent"])
app.include_router(scheduling, prefix="/api/v1/scheduling", tags=["Scheduling"])
app.include_router(billing, prefix="/api/v1/billing", tags=["Billing"])
app.include_router(ai, prefix="/api/v1/ai", tags=["AI"])

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.1.0", "ai": "active"}

@app.post("/api/v1/simulate")
async def simulate_pipeline():
    from app.modules.ai.fusion import ai_fusion
    return {"status": "success", "results": await ai_fusion.simulate_full_flow({})}

@app.websocket("/ws/{encounter_id}")
async def encounter_ws(websocket: WebSocket, encounter_id: str):
    # Enforce Consent check at WebSocket level
    from app.models.encounter import Encounter
    from beanie import PydanticObjectId
    from bson.objectid import ObjectId
    
    try:
        if not ObjectId.is_valid(encounter_id):
            encounter = await Encounter.find_one(Encounter.id == encounter_id)
        else:
            encounter = await Encounter.get(PydanticObjectId(encounter_id))
        
        if encounter and not encounter.consent_obtained:
            await websocket.accept()
            await websocket.send_text(json.dumps({"error": "Patient consent required before recording can begin"}))
            await websocket.close(code=4003)
            return
    except Exception as e:
        print(f"WS Consent Check Error: {e}")

    await websocket.accept()
    from app.modules.ai.fusion import ai_fusion
    try:
        while True:
            # Receive audio chunk
            data = await websocket.receive_bytes()
            
            # Process stream
            result = await ai_fusion.process_encounter_stream(encounter_id, data, live=True)
            
            # Send back JSON result
            await websocket.send_text(json.dumps(result))
    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass
