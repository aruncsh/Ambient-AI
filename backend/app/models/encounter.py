from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional, Union

class SOAPSection(BaseModel):
    history_of_present_illness: str = ""
    physical_examination: str = ""
    clinical_reasoning: str = ""
    precautions: str = ""

class SOAPNote(BaseModel):
    subjective: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    objective: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    assessment: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    plan: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    patient_history: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    follow_up: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    billing: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    ros: Optional[Union[Dict[str, Any], str]] = Field(default_factory=dict)
    clean_transcript: Optional[str] = ""
    raw_transcript: Optional[str] = ""
    generated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    extracted_diagnosis: Optional[List[str]] = Field(default_factory=list)
    extracted_symptoms: Optional[List[str]] = Field(default_factory=list)
    extracted_vitals: Optional[Dict[str, Any]] = Field(default_factory=dict)

class Encounter(Document):
    id: Optional[Union[PydanticObjectId, str]] = Field(default=None, alias="_id")
    patient_id: Optional[str] = "Anonymous"
    patient_name: Optional[str] = "Anonymous Patient"
    clinician_id: Optional[str] = "System"
    status: Optional[str] = "active"
    recording_path: Optional[str] = None
    transcript: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    vitals: Optional[Dict[str, Any]] = Field(default_factory=lambda: {
        "heart_rate": {"value": None, "trend": []},
        "blood_pressure": {"value": None, "trend": []},
        "oxygen_saturation": {"value": None, "trend": []},
        "temperature": {"value": None, "trend": []},
        "respiratory_rate": {"value": None, "trend": []}
    })
    soap_note: Optional[SOAPNote] = None
    billing_codes: Optional[List[Any]] = Field(default_factory=list)
    billing_amount: Optional[float] = 500.0
    billing_currency: Optional[str] = "INR"
    invoice_id: Optional[str] = None
    consent_obtained: Optional[bool] = False
    consent_audio_url: Optional[str] = None
    consent_signature_url: Optional[str] = None
    fhir_id: Optional[str] = None
    fhir_status: Optional[str] = "pending"
    icd10_codes: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    nlp_insights: Optional[Dict[str, Any]] = Field(default_factory=dict)
    emotions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    lab_orders: Optional[List[Union[Dict[str, Any], str]]] = Field(default_factory=list)
    prescriptions: Optional[List[Union[Dict[str, Any], str]]] = Field(default_factory=list)
    is_emergency: Optional[bool] = False
    current_demographics: Optional[Dict[str, Any]] = Field(default_factory=dict)
    missing_fields: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    registration_status: Optional[str] = "pending" # pending, existing, new
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "encounters"
