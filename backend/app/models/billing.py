from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class Invoice(Document):
    patient_id: str
    patient_name: str = "Anonymous Patient"
    encounter_id: str
    amount: float
    status: str = "pending"
    due_date: datetime = Field(default_factory=lambda: datetime.utcnow())

    class Settings:
        name = "invoices"
