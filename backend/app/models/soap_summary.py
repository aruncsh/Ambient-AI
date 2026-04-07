from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Dict, Any, Optional

class SOAPSummary(Document):
    encounter_id: str
    patient_id: str
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    full_transcript: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "soap_summaries"
