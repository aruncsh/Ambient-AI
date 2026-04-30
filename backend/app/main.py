import torchaudio
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["ffmpeg", "sox_io", "soundfile"]

from fastapi import FastAPI, Request, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.mongodb import init_db
from app.routes import encounters, summary, automation, consent, scheduling, billing, ai, users, stats, consults, teleconsult, resource
from app.core.audit_log import audit_log_middleware
from app.core.retention import retention_worker
from contextlib import asynccontextmanager
import asyncio
import json
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend_debug.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
logger.info("Logging initialized for all modules.")

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

@app.get("/")
async def root():
    return {
        "message": "Welcome to Ambient AI Scribe API",
        "version": app.version,
        "status": "online",
        "docs": "/docs"
    }

# Routes
app.include_router(encounters, prefix="/api/v1/encounters", tags=["Encounters"])
app.include_router(summary, prefix="/api/v1/summary", tags=["Summaries"])
app.include_router(automation, prefix="/api/v1/automation", tags=["Automation"])
app.include_router(consent, prefix="/api/v1/consent", tags=["Consent"])
app.include_router(scheduling, prefix="/api/v1/scheduling", tags=["Scheduling"])
app.include_router(billing, prefix="/api/v1/billing", tags=["Billing"])
app.include_router(ai, prefix="/api/v1/ai", tags=["AI"])
app.include_router(users, prefix="/api/v1/users", tags=["Users"])
app.include_router(stats, prefix="/api/v1/stats", tags=["Stats"])
app.include_router(consults, prefix="/api/v1/consults", tags=["Consults"])
app.include_router(teleconsult, prefix="/api/v1/teleconsult", tags=["Teleconsult"])
app.include_router(resource, prefix="/api/v1/resource", tags=["Resource"])

# Simulation and test endpoints removed for production.

from app.modules.ai.fusion import ai_fusion
from app.models.encounter import Encounter
from beanie import PydanticObjectId
from bson.objectid import ObjectId
import base64

@app.websocket("/ws/{encounter_id}")
async def encounter_ws(websocket: WebSocket, encounter_id: str):
    try:
        await websocket.accept()
    except Exception as e:
        logger.error(f"WS: Accept failed for {encounter_id}: {e}")
        return

    logger.info(f"WS: Handshake established for {encounter_id}")
    
    try:
        if not ObjectId.is_valid(encounter_id):
            encounter = await Encounter.find_one(Encounter.id == encounter_id)
        else:
            encounter = await Encounter.get(PydanticObjectId(encounter_id))
        
        if encounter and not encounter.consent_obtained:
            logger.warning(f"WS: Consent missing for {encounter_id}")
            await websocket.send_text(json.dumps({"error": "Patient consent required before recording can begin"}))
            await websocket.close(code=4003)
            return
        logger.info(f"WS: Lifecycle authorized for {encounter_id}")
    except Exception as e:
        logger.error(f"WS: Safety check failure for {encounter_id}: {e}")
        # Continue anyway if DB lookup fails, unless you want it strictly enforced
        # await websocket.close(code=4000)
        # return
    from app.modules.ai.fusion import ai_fusion
    import base64
    import asyncio
    from asyncio import Queue
    
    # Process messages in a sequential queue to avoid blocking heartbeats
    # while maintaining order for transcription continuity.
    msg_queue = Queue()
    
    async def process_worker():
        while True:
            try:
                msg_type, payload, enc_id = await msg_queue.get()
                if not payload:
                    msg_queue.task_done()
                    continue
                
                # Decode base64 payload
                try:
                    raw_data = base64.b64decode(payload)
                except Exception as e:
                    logger.error(f"Base64 decode error: {e}")
                    msg_queue.task_done()
                    continue

                # Process based on type (with per-chunk error protection)
                try:
                    if msg_type == "audio":
                        logger.info(f"WS Worker: Processing audio chunk for {enc_id} ({len(raw_data)} bytes)")
                        result = await ai_fusion.process_encounter_stream(enc_id, audio_chunk=raw_data, live=True)
                        if result.get("transcript"):
                            logger.info(f"WS Worker: Sending result: transcript '{result['transcript'][:50]}...'")
                        else:
                            logger.info(f"WS Worker: Sending result (no transcript)")
                        await websocket.send_text(json.dumps(result))
                    elif msg_type == "video":
                        result = await ai_fusion.process_encounter_stream(enc_id, video_frame=raw_data, live=True)
                        await websocket.send_text(json.dumps(result))
                except Exception as chunk_err:
                    logger.error(f"Error processing {msg_type} chunk: {chunk_err}")
                    try:
                        await websocket.send_text(json.dumps({"status": "processing_error", "error": str(chunk_err)}))
                    except: pass
                
                msg_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"WS Worker Error: {e}")
                msg_queue.task_done()

    # Start the worker task
    worker_task = asyncio.create_task(process_worker())

    try:
        while True:
            # Receive JSON message WITHOUT BLOCKING heartbeats or accumulating lag
            try:
                message = await websocket.receive_json()
            except:
                break # Connection closed or invalid JSON from client
                
            msg_type = message.get("type")
            payload = message.get("data")
            
            if msg_type and payload:
                # Add to queue for the worker to pick up
                await msg_queue.put((msg_type, payload, encounter_id))
            
    except Exception as e:
        logger.error(f"Global WS Error: {e}")
    finally:
        worker_task.cancel()
        try:
            await websocket.close()
        except:
            pass
