from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class AuditLog(Document):
    user_id: Optional[str] = "anonymous"
    action: Optional[str] = "action"
    resource_id: Optional[str] = "resource"
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "audit_log"
