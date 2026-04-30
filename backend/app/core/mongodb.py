from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
import asyncio
import logging

logger = logging.getLogger(__name__)

# --- MONKEY PATCH FOR BEANIE 1.25.0 BUG ---
# Older versions of Beanie try to call append_metadata on AsyncIOMotorClient
# which causes a "MotorDatabase object is not callable" crash on Motor >= 3.6.0
if not hasattr(AsyncIOMotorClient, "append_metadata"):
    AsyncIOMotorClient.append_metadata = lambda self, *args, **kwargs: None
# ------------------------------------------

# Import models for Beanie initialization
from app.models.encounter import Encounter
from app.models.soap_summary import SOAPSummary
from app.models.audit_log import AuditLog
from app.models.consent import Consent
from app.models.api_response_log import APIResponseLog
from app.models.scheduling import Appointment
from app.models.billing import Invoice
from app.models.user import Patient, Doctor
from app.models.consult import Consult, ConsultParticipant

MAX_RETRIES = 5
RETRY_DELAYS = [2, 5, 10, 20, 30]  # seconds between retries

async def init_db():
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"MongoDB connection attempt {attempt + 1}/{MAX_RETRIES}...")
            client = AsyncIOMotorClient(
                settings.MONGO_URL,
                serverSelectionTimeoutMS=30000,  # 30s server selection
                connectTimeoutMS=30000,          # 30s connection timeout
                socketTimeoutMS=45000,           # 45s socket timeout
            )
            try:
                db = client.get_default_database()
            except Exception:
                db = client["ambient_ai"]

            await init_beanie(
                database=db,
                document_models=[
                    Encounter,
                    SOAPSummary,
                    AuditLog,
                    Consent,
                    APIResponseLog,
                    Appointment,
                    Invoice,
                    Patient,
                    Doctor,
                    Consult,
                    ConsultParticipant
                ]
            )
            logger.info("MongoDB connected successfully!")
            return  # Success — exit the retry loop
        except Exception as e:
            delay = RETRY_DELAYS[attempt] if attempt < len(RETRY_DELAYS) else 30
            logger.warning(f"MongoDB connection attempt {attempt + 1} failed: {e}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                logger.error("All MongoDB connection attempts failed. Exiting.")
                raise
