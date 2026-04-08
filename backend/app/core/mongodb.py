from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings

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

async def init_db():
    client = AsyncIOMotorClient(
        settings.MONGO_URL,
        serverSelectionTimeoutMS=5000 # 5 second timeout
    )
    await init_beanie(
        database=client.get_default_database(),
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
