from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from app.models.consult import Consult, ConsultParticipant
from app.models.encounter import Encounter
from app.models.user import Patient, Doctor
from app.modules.cureselect import cureselect_client
from app.core.security import create_access_token
from beanie import PydanticObjectId
import logging

logger = logging.getLogger(__name__)

class ConsultService:
    @staticmethod
    async def token_validate(token: str) -> Dict[str, Any]:
        """
        Validates a teleconsult token and performs local login.
        """
        info = await ConsultService.get_consult_info(token)
        if "error" in info:
            return info

        patient_id = info["patient_id"]
        
        # 1. Fetch patient/user details
        patient = None
        if patient_id != "-1":
             try:
                 patient = await Patient.get(PydanticObjectId(patient_id))
             except:
                 pass
        
        if not patient:
             return {"error": "Patient associated with this consult not found in local node"}

        # 2. Generate local token (consult session auth)
        local_token = create_access_token({"sub": str(patient.id), "role": "patient", "consult_id": info["consult_id"]})
        
        return {
            "userInfo": {
                "id": str(patient.id),
                "name": patient.name,
                "email": patient.email,
                "role": "patient"
            },
            "token": local_token,
            "consult_id": info["consult_id"],
            "consult": info["consultInfo"][0] if info["consultInfo"] else {"id": info["consult_id"]},
            "info": info["provider_info"]
        }

    @staticmethod
    async def fetch_consult(consult_id: str, role: str, participant_id: str) -> Dict[str, Any]:
        """
        Purely fetches consult data from the microservice.
        """
        data = await cureselect_client.fetch_consult(consult_id, role, participant_id)
        if not data:
             return {"error": "Consult not found on microservice uplink"}
        return data

    @staticmethod
    async def start_consult(consult_id: str, role: str, participant_id: str) -> Dict[str, Any]:
        """
        Starts the session via microservice only.
        """
        # Notify external microservice source of truth
        ext_data = await cureselect_client.start_consult(consult_id, role, participant_id)
        return ext_data or {"status": "success"}

    @staticmethod
    async def end_consult(consult_id: str, role: str, participant_id: str, notes: Optional[str] = None) -> Dict[str, Any]:
        """
        Ends the session via microservice only.
        """
        # Notify external microservice source of truth
        ext_data = await cureselect_client.end_consult(consult_id, role, participant_id, notes)
        return ext_data or {"status": "success"}

    @staticmethod
    async def get_consult_info(token: str) -> Dict[str, Any]:
        """
        Replicates PHP getConsultInfo logic.
        """
        # 1. Validate token with microservice
        consult_info = await cureselect_client.get_consult_details(token)
        if not consult_info:
            return {"patient_id": "-1", "consult_id": "-1", "error": "Invalid token"}

        # 2. Extract consult_id and patient_id from response
        # In PHP it looks into info, participants, etc.
        data = consult_info.get("data", {})
        consult_details = data.get("consult", {})
        consult_id = consult_details.get("id", "-1")
        
        patient_id = "-1"
        participants = data.get("participants", [])
        for p in participants:
            if not p.get("is_guest") and "guest" not in str(p.get("ref_number", "")):
                 patient_id = str(p.get("ref_number", "-1"))
                 break
        
        # 3. Fetch detailed consult info (fetchById in PHP)
        detailed_consult = await cureselect_client.fetch_by_id(consult_id) if consult_id != "-1" else None
        
        return {
            "patient_id": patient_id,
            "consult_id": consult_id,
            "provider_info": data.get("info", {}),
            "consultInfo": detailed_consult.get("data", {}).get("consults", []) if detailed_consult else []
        }

    @staticmethod
    async def get_consult_summary(token: str) -> Dict[str, Any]:
        """
        Replicates PHP consultSummary logic. Aggregates data for the consult session.
        """
        info = await ConsultService.get_consult_info(token)
        patient_id = info["patient_id"]
        consult_id = info["consult_id"]

        if patient_id == "-1":
             return {"error": "Patient not identified"}

        summary = {}

        # 1. Profile information
        patient = await Patient.get(PydanticObjectId(patient_id)) if len(patient_id) > 5 else None
        if patient:
            summary["1_profile"] = {
                "first_name": patient.name.split()[0] if patient.name else "",
                "last_name": patient.name.split()[-1] if patient.name and len(patient.name.split()) > 1 else "",
                "dob": patient.date_of_birth,
                "gender": patient.gender,
                "blood_group": patient.blood_group
            }
        else:
            summary["1_profile"] = None

        # 2. Clinical Data - Try to pull from an Encounter matching this consult_id (stored in additional_info)
        # or just matching the patient_id if it's the latest.
        encounter = await Encounter.find_one({"additional_info.external_id": consult_id})
        if not encounter:
            # Fallback to latest encounter for this patient
            encounter = await Encounter.find_one({"patient_id": patient_id}).sort("-created_at")

        if encounter:
            summary["2_vital"] = encounter.vitals
            summary["3_health"] = encounter.soap_note.subjective if encounter.soap_note else {}
            summary["4_ros"] = encounter.soap_note.ros if encounter.soap_note else {}
            summary["5_pe"] = encounter.soap_note.objective if encounter.soap_note else {}
            summary["6_stroke_scale"] = encounter.nlp_insights.get("stroke_scale", [])
            summary["7_history"] = encounter.soap_note.patient_history if encounter.soap_note else {}
            summary["8_doc"] = [] # Placeholder for documents
        else:
            summary["2_vital"] = []
            summary["3_health"] = []
            summary["4_ros"] = []
            summary["5_pe"] = []
            summary["6_stroke_scale"] = []
            summary["7_history"] = []
            summary["8_doc"] = []

        summary["provider_details"] = info["provider_info"]
        summary["0_consult_details"] = info["consultInfo"]

        return summary

    @staticmethod
    async def handle_event(consult_id: str, role: str, participant_id: str, event: str) -> Dict[str, Any]:
        """
        Handles meeting engine events (Joined, Left, etc) exclusively via microservice.
        """
        await cureselect_client.notify_event(consult_id, role, participant_id, event)
        return {"status": "success"}

    @staticmethod
    async def invite_guests(consult_id: str, role: str, participant_id: str, invites: List[Dict[str, Any]]) -> Dict[str, Any]:
        return await cureselect_client.invite_guests(consult_id, role, participant_id, invites)

    @staticmethod
    async def switch_provider(consult_id: str, role: str, participant_id: str, provider: str) -> Dict[str, Any]:
        return await cureselect_client.switch_provider(consult_id, role, participant_id, provider)

    @staticmethod
    async def fetch_consults(filters: Dict[str, Any], limit: int = 15, page: int = 1) -> Dict[str, Any]:
        """
        Fetches list of consults from microservice.
        """
        data = await cureselect_client.fetch_consults(filters, limit, page)
        if not data:
             return {"data": {"consults": [], "pagination": {}}}
        
        # Wrap like PHP TeleConsultService@list
        result = {}
        if data.get("data"):
             result["consults"] = data["data"].get("consults", [])
             result["pagination"] = data["data"].get("pagination", {})
        else:
             result["consults"] = data.get("consults", [])
             result["pagination"] = data.get("pagination", {})
        
        return result

consult_service = ConsultService()
