from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class Appointment(Document):
    patient_id: str
    patient_name: Optional[str] = None
    clinician_id: str
    clinician_name: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str = "scheduled"
    type: str = "In-person"
    reason: Optional[str] = None
    teleconsult_link: Optional[str] = None
    teleconsult_status: Optional[str] = "idle" # idle, calling, active, ended
    additional_info: dict = Field(default_factory=dict)

    class Settings:
        name = "appointments"
