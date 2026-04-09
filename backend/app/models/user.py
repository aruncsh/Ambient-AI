from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import List, Dict, Any, Optional, Union

class Patient(Document):
    id: Optional[Union[PydanticObjectId, str]] = Field(default=None, alias="_id")
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[List[str]] = Field(default_factory=list)
    allergies: Optional[List[str]] = Field(default_factory=list)
    is_consent_given: bool = False
    is_active: bool = True
    external_id: Optional[Indexed(str)] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "patients"

class Doctor(Document):
    id: Optional[Union[PydanticObjectId, str]] = Field(default=None, alias="_id")
    name: str
    email: EmailStr
    phone: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    experience_years: Optional[int] = None
    department: Optional[str] = None
    is_active: bool = True
    external_id: Optional[Indexed(str)] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "doctors"
