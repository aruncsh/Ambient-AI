from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class Consent(Document):
    encounter_id: str
    patient_id: str = "Anonymous"
    patient_name: str = "Anonymous Patient"
    type: str = "audio_recording"
    status: str = "obtained" # obtained, revoked, pending
    obtained_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = None
    signature_blob: Optional[bytes] = None

    class Settings:
        name = "consents"
