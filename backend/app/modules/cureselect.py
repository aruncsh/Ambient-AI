import httpx
import json
import logging
from typing import Optional, Dict, Any, List, Union
from app.core.config import settings
from datetime import datetime, timedelta
from app.models.user import Patient, Doctor
from beanie import PydanticObjectId

logger = logging.getLogger(__name__)

class CureSelectClient:
    def __init__(self):
        self.base_url = settings.CURESELECT_API_ENDPOINT.rstrip('/')
        self.client_id = settings.CURESELECT_API_CLIENT_ID
        self.client_secret = settings.CURESELECT_API_CLIENT_SECRET
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    async def _get_token(self) -> str:
        if self._token and self._token_expiry and datetime.now() < self._token_expiry:
             return self._token
        
        try:
            url = f"{self.base_url}/v1/users/authenticate/api"
            payload = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials"
            }
            
            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                resp = await client.post(url, json=payload)
                
                if resp.status_code != 200:
                    logger.error(f"CureSelect Auth failure: Status {resp.status_code} - {resp.text}")
                    return ""
                
                # Check Authorization header first (as in PHP)
                auth_header = resp.headers.get("Authorization")
                if auth_header:
                    self._token = auth_header
                else:
                    data = resp.json()
                    # Some implementations put it in data.token or data.data.token
                    self._token = data.get("token") or data.get("data", {}).get("token")
                
                if not self._token:
                    logger.error(f"CureSelect Auth: No token found in response - {resp.text}")
                    return ""

                # Default expiry to 23 hours (as in PHP minutes = 1380)
                self._token_expiry = datetime.now() + timedelta(hours=23)
                return self._token
        except Exception as e:
            logger.error(f"CureSelect Auth exception: {e}")
            return ""

    async def _api_request(self, method: str, path: str, **kwargs) -> Optional[Dict[str, Any]]:
        token = await self._get_token()
        if not token:
            logger.warning(f"No auth token for CureSelect API request: {method} {path}")
            return None
        
        headers = kwargs.get("headers", {})
        # Ensure token has Bearer prefix if it doesn't already
        auth_val = token if token.startswith("Bearer ") else f"Bearer {token}"
        headers["Authorization"] = auth_val
        headers["Accept"] = "application/json"
        kwargs["headers"] = headers

        try:
            url = f"{self.base_url}/v1/{path.lstrip('/')}"
            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                resp = await client.request(method, url, **kwargs)
                if resp.status_code >= 400:
                    logger.error(f"CureSelect API Error [{method} {path}]: {resp.status_code} - {resp.text}")
                    return None
                return resp.json()
        except Exception as e:
            logger.error(f"CureSelect Connection Error [{method} {path}]: {e}")
            return None

    async def fetch_consults(self, filters: Dict[str, Any], limit: int = 15, page: int = 1) -> Optional[Dict[str, Any]]:
        # PHP path: resource/consults
        params = {**filters, "limit": limit, "page": page}
        return await self._api_request("GET", "resource/consults", params=params)

    async def create_consult(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # PHP path: resource/consults
        return await self._api_request("POST", "resource/consults", json=payload)

    async def create_resource_consult(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Creates a consult using the standard resource payload format supplied.
        Replicated from the requested Garuda payload format.
        """
        patient_id = data.get("patient_id")
        clinician_id = data.get("clinician_id")
        
        patient = None
        if patient_id:
             try:
                 patient = await Patient.get(PydanticObjectId(patient_id))
             except:
                 pass
        
        doctor = None
        if clinician_id:
             try:
                 doctor = await Doctor.get(PydanticObjectId(clinician_id))
             except:
                 pass

        # Parse start_time
        start_time_str = data.get("start_time")
        if isinstance(start_time_str, str):
            try:
                # Handle ISO format from frontend (e.g. 2024-03-20T10:00:00.000Z)
                start_dt = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            except:
                start_dt = datetime.now()
        elif isinstance(start_time_str, datetime):
            start_dt = start_time_str
        else:
            start_dt = datetime.now()

        # Parse end_time or default to +15 mins
        end_time_str = data.get("end_time")
        if end_time_str:
            try:
                end_dt = datetime.fromisoformat(str(end_time_str).replace('Z', '+00:00'))
            except:
                end_dt = start_dt + timedelta(minutes=15)
        else:
            end_dt = start_dt + timedelta(minutes=15)

        # Build payload based on user's sample
        # Note: In the sample provider_id: 0 and patient_id: 10 might be integers on their end
        # We try to use numeric IDs if available, else fallback to placeholders
        
        # Check if the IDs are already numeric (like "10")
        final_patient_id = 10
        if patient_id:
             if str(patient_id).isdigit(): final_patient_id = int(patient_id)
             elif patient: final_patient_id = int(str(patient.id)[-4:], 16) % 1000

        final_provider_id = 0
        if clinician_id:
             if str(clinician_id).isdigit(): final_provider_id = int(clinician_id)
             elif doctor: final_provider_id = int(str(doctor.id)[-4:], 16) % 1000

        payload = {
            "consult_date": start_dt.strftime("%Y-%m-%d"),
            "provider_id": final_provider_id,
            "consult_time": start_dt.strftime("%H:%M"),
            "patient_id": final_patient_id,
            "patient_name": patient.name if patient else data.get("patient_name") or "Ram Mohan",
            "speciality": doctor.specialization if doctor and doctor.specialization else data.get("speciality") or "unknown",
            "reason_for_consult": data.get("reason") or "Garuda Consult Call",
            "consult_doctor": doctor.name if doctor else "UnKnown",
            "doctor_mobile": doctor.phone if doctor and doctor.phone else "+917540032060",
            "teleType": "1",
            "consult_date_time": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "consult_end_time": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "cart_camera": data.get("cart_camera") or {
                "camera_ip": "192.168.5.163",
                "camera_name": "Internal IP Camera",
                "camera_type": "minrray",
                "camera_short_name": "M"
            }
        }

        # Add any additional info from data if present
        if data.get("additional_info"):
            payload.update(data["additional_info"])

        return await self.create_consult(payload)

    async def token_validate(self, token: str) -> Optional[Dict[str, Any]]:
         # PHP path: consults/token-validate
         return await self._api_request("GET", "consults/token-validate", params={"token": token})

    async def patch_consult(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # PHP path: resource/consults/{id}
        consult_id = data.get("id")
        return await self._api_request("PATCH", f"resource/consults/{consult_id}", json=data)

    async def get_consult_details(self, token: str) -> Optional[Dict[str, Any]]:
        # PHP path: teleconsult/token-validate?token=...
        return await self._api_request("GET", "teleconsult/token-validate", params={"token": token})

    async def fetch_by_id(self, consult_id: str) -> Optional[Dict[str, Any]]:
        # PHP path: resource/consults/{id}
        return await self._api_request("GET", f"resource/consults/{consult_id}")

    async def start_consult(self, consult_id: str, role: str, participant_id: str) -> Optional[Dict[str, Any]]:
        # Older logic or domain specific? Keeping for compatibility
        return await self._api_request("PATCH", f"consults/{consult_id}/{role}/{participant_id}/start")

    async def end_consult(self, consult_id: str, role: str, participant_id: str, notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
        payload = {"consult_notes": notes} if notes else {}
        return await self._api_request("PATCH", f"consults/{consult_id}/{role}/{participant_id}/end", json=payload)

cureselect_client = CureSelectClient()
