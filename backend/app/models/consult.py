from beanie import Document, PydanticObjectId, Indexed
from pydantic import Field, BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
import secrets

class ConsultParticipant(Document):
    consult_id: PydanticObjectId
    role: str # Publisher (Doctor), Subscriber (Patient)
    ref_number: str
    participant_info: Dict[str, Any] = Field(default_factory=dict)
    participant_status: str = "NotStarted"
    consult_data: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "consult_participants"

    def get_basic_info(self):
        return {
            "id": str(self.id),
            "role": self.role,
            "ref_number": self.ref_number,
            "name": self.participant_info.get("name", "Unknown"),
            "status": self.participant_status
        }

class Consult(Document):
    entity_id: Optional[str] = None
    consult_status: str = "New"
    scheduled_at: datetime = Field(default_factory=datetime.utcnow)
    consult_code: Optional[str] = None
    consult_type: str = "Virtual"
    consult_data: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    started_participant_id: Optional[PydanticObjectId] = None
    ended_participant_id: Optional[PydanticObjectId] = None
    reason: Optional[str] = None
    virtual_service_provider: str = "TokBox"
    followup_date: Optional[datetime] = None
    additional_info: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "consults"

    async def participants(self) -> List[ConsultParticipant]:
        return await ConsultParticipant.find(ConsultParticipant.consult_id == self.id).to_list()

    def meeting_exists(self, service_provider: str) -> bool:
        provider_data = self.consult_data.get(service_provider)
        return provider_data is not None and provider_data.get("meeting_id") is not None

    def start_meeting(self, virtual_service_provider: str):
        if not self.meeting_exists(virtual_service_provider):
            if virtual_service_provider == "TokBox":
                # Mock TokBox session (usually fetched from OpenTok API)
                self.consult_data[virtual_service_provider] = {
                    "meeting_id": f"tokbox_{secrets.token_hex(16)}",
                    "api_key": "47123456" # Placeholder
                }
            else:
                # Fallback
                self.consult_data[virtual_service_provider] = {
                    "meeting_id": f"gen_{secrets.token_hex(16)}"
                }

    async def get_info(self, participant: ConsultParticipant) -> Dict[str, Any]:
        provider = self.virtual_service_provider
        return {
            "id": str(self.id),
            "status": self.consult_status,
            "consult_data": self.consult_data.get(provider, {}),
            "virtual_service_provider": provider,
            "participant_status": participant.participant_status,
            "additional_info": self.additional_info
        }

    async def join_consult(self, participant: ConsultParticipant):
        if self.consult_status == "Waiting":
            self.consult_status = "Started"
        participant.participant_status = "Joined"
        await participant.save()
        await self.save()
