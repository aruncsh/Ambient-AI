from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional, Dict, Any

class APIResponseLog(Document):
    user_id: Optional[str] = None
    endpoint: str
    method: str
    status_code: int
    response_time: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "api_response_logs"
