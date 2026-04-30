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
            base_url = self.base_url.rstrip('/')
            url = f"{base_url}/v1/users/authenticate/api"
            
            payload = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials"
            }
            
            async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
                # Based on diagnostic, JSON works, Form fails with 500
                resp = await client.post(url, json=payload)
                
                if resp.status_code != 200:
                    logger.error(f"CureSelect Auth failure: Status {resp.status_code} - {resp.text}")
                    return ""
                
                data = resp.json()
                # Extraction logic for Garuda v3
                # It's usually in data.token or data.data.token
                token_val = data.get("token") or data.get("data", {}).get("token")
                
                if not token_val:
                    # Alternative check for PHP style responses
                    token_val = resp.headers.get("Authorization")
                
                if not token_val:
                    logger.error(f"CureSelect Auth: No token found in response - {resp.text}")
                    return ""

                self._token = token_val
                # Default expiry to 23 hours
                self._token_expiry = datetime.now() + timedelta(hours=23)
                return self._token
        except Exception as e:
            logger.error(f"CureSelect Auth exception: {e}")
            return ""

    async def _api_request(self, method: str, path: str, **kwargs) -> Optional[Dict[str, Any]]:
        headers = kwargs.get("headers", {})
        api_token = await self._get_token()
        if api_token:
            # Diagnostic confirmed Bearer is MUST
            headers["Authorization"] = f"Bearer {api_token}"
            headers["X-Entity-ID"] = settings.CURESELECT_ENTITY_ID
        
        kwargs["headers"] = headers
        headers["Accept"] = "application/json"
        
        # Inject Entity ID if available (Critical for some Garuda instances)
        if settings.CURESELECT_ENTITY_ID:
             headers["X-Entity-ID"] = settings.CURESELECT_ENTITY_ID
             
        kwargs["headers"] = headers

        # Robust URL construction: if base_url already contains 'v1', don't add it again.
        clean_base = self.base_url.rstrip('/')
        if '/v1' in clean_base:
             url = f"{clean_base}/{path.lstrip('/')}"
        else:
             # Default to adding /v1 for Garuda microservices
             url = f"{clean_base}/v1/{path.lstrip('/')}"

        try:
            async with httpx.AsyncClient(verify=False) as client:
                response = await client.request(method, url, timeout=30.0, **kwargs)
                
                # Check for errors
                if response.status_code >= 400:
                    print(f"DEBUG: CureSelect API Error [{method} {url}]: {response.status_code} - {response.text}")
                    logger.error(f"CureSelect API Error [{method} {url}]: {response.status_code} - {response.text}")
                    return None
                
                print(f"DEBUG: CureSelect API Success [{method} {url}]: {response.status_code}")
                logger.debug(f"CureSelect API Success [{method} {path}]: {response.status_code}")
                return response.json()
        except Exception as e:
            logger.error(f"CureSelect API Exception [{method} {url}]: {str(e)}")
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
        clinician_id = data.get("clinician_id") or data.get("provider_id")
        
        patient = None
        if patient_id and len(str(patient_id)) == 24:
             try:
                  patient = await Patient.get(PydanticObjectId(patient_id))
             except:
                  pass
        
        doctor = None
        if clinician_id and len(str(clinician_id)) == 24:
             try:
                  doctor = await Doctor.get(PydanticObjectId(clinician_id))
             except:
                  pass

        # Parse start_time
        start_time_str = data.get("start_time") or data.get("consult_date")
        if isinstance(start_time_str, str):
            try:
                # Handle ISO format
                start_dt = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            except:
                start_dt = datetime.now()
        elif isinstance(start_time_str, datetime):
            start_dt = start_time_str
        else:
            start_dt = datetime.now()

        # Prepare temporal data
        start_time_raw = data.get("start_time") or data.get("start_time_str")
        try:
            if start_time_raw:
                if "Z" in str(start_time_raw):
                    start_dt = datetime.fromisoformat(str(start_time_raw).replace("Z", "+00:00"))
                else:
                    start_dt = datetime.fromisoformat(str(start_time_raw))
            else:
                start_dt = datetime.now()
        except Exception:
            start_dt = datetime.now()

        # Map UUIDs to numeric IDs if strings are provided, else use the integers if provided
        final_patient_id = 484 # From sample
        if patient_id:
            if isinstance(patient_id, int):
                final_patient_id = patient_id
            elif str(patient_id).isdigit():
                final_patient_id = int(patient_id)
            elif patient:
                final_patient_id = int(str(patient.id)[-4:], 16) % 9000 + 1000

        final_provider_id = 448 # From sample
        if clinician_id:
            if isinstance(clinician_id, int):
                final_provider_id = clinician_id
            elif str(clinician_id).isdigit():
                final_provider_id = int(clinician_id)
            elif doctor:
                final_provider_id = int(str(doctor.id)[-4:], 16) % 9000 + 1000
        
        # Prepare the V3 structured payload based on 422 diagnostic results
        # Required: scheduled_at, consult_type (String!), participants[ref_number, participant_info]
        payload = {
            "entity_id": int(settings.CURESELECT_ENTITY_ID) if settings.CURESELECT_ENTITY_ID and str(settings.CURESELECT_ENTITY_ID).isdigit() else 25,
            "consult_date": start_dt.strftime("%Y-%m-%d"),
            "consult_time": start_dt.strftime("%H:%M"),
            "scheduled_at": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "consult_type": "virtual", 
            "virtual_service_provider": "tokbox",
            "provider_id": str(final_provider_id),
            "patient_id": str(final_patient_id),
            "patient_name": patient.name if patient else data.get("patient_name_str") or data.get("patient_name") or "Ram Mohan",
            "speciality": data.get("speciality") or "unknown",
            "reason_for_consult": data.get("reason") or data.get("reason_for_consult") or "Garuda Consult Call",
            "consult_doctor": doctor.name if doctor else data.get("clinician_name") or data.get("consult_doctor") or "UnKnown",
            "doctor_mobile": doctor.phone if doctor and doctor.phone else data.get("doctor_mobile") or "+917540032060",
            "teleType": "1",
            "additional_info": {
                "api_end_point": "https://services-api.a2zhealth.in",
                "api_end_version": "v1",
                "x_name": "garuda"
            },
            "participants": [
                {
                    "role": "publisher",
                    "ref_number": str(final_provider_id),
                    "participant_info": {
                        "name": doctor.name if doctor else data.get("clinician_name") or "Doctor",
                        "email": doctor.email if doctor else "doctor@a2zhealth.in"
                    }
                },
                {
                    "role": "subscriber",
                    "ref_number": str(final_patient_id),
                    "participant_info": {
                        "name": patient.name if patient else data.get("patient_name") or "Patient",
                        "email": patient.email if patient else "patient@a2zhealth.in"
                    }
                }
            ]
        }

        logger.info(f"CureSelect creation attempt [POST v1/resource/consults] Payload: {payload}")
        return await self._api_request("POST", "resource/consults", json=payload)

    async def fetch_consult_counts(self, statuses: List[str], filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # PHP path: consults/count-by-status
        params = {**filters, "consult_status": statuses}
        return await self._api_request("GET", "consults/count-by-status", params=params)


    async def token_validate(self, token: str) -> Optional[Dict[str, Any]]:
         # PHP path: consults/token-validate
         return await self._api_request("GET", "consults/token-validate", params={"token": token})

    async def update_consult(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Standard PATCH for consult resources. Strips ID from body to avoid 422.
        """
        consult_id = data.get("id")
        if not consult_id:
             logger.error("Attempted to update consult without ID")
             return None
        payload = {k: v for k, v in data.items() if k != "id"}
        return await self._api_request("PATCH", f"resource/consults/{consult_id}", json=payload)

    async def get_consult_details(self, token: str) -> Optional[Dict[str, Any]]:
        """
        PHP getSession/validateToken logic.
        """
        params = {"token": token}
        # Try primary v3 paths
        paths = ["consults/token-validate", "resource/consults/token-validate", "token-validate", "session-validate"]
        
        res = None
        for path in paths:
             res = await self._api_request("GET", path, params=params)
             if res: break
        
        # If still no data.participants, use listing as fallback to find tokens correctly
        if res and not res.get("data", {}).get("participants"):
             consult_id = res.get("data", {}).get("consult", {}).get("id")
             if consult_id:
                  logger.info(f"Participants missing in validation, fetching via listing for consult {consult_id}")
                  list_res = await self._api_request("GET", f"resource/consults?consult_id={consult_id}&limit=1")
                  if list_res and list_res.get("data", {}).get("consults"):
                       # Merge listing data into validation response
                       if isinstance(list_res["data"]["consults"], list) and len(list_res["data"]["consults"]) > 0:
                            res["data"]["participants"] = list_res["data"]["consults"][0].get("participants", [])
        return res

    async def fetch_by_id(self, consult_id: str) -> Optional[Dict[str, Any]]:
        # PHP path: resource/consults/{id}
        return await self._api_request("GET", f"resource/consults/{consult_id}")

    async def start_consult(self, consult_id: str, role: str, participant_id: str) -> Optional[Dict[str, Any]]:
        # Updated to match Garuda v3 resource-based path structure
        # If it returns 404, we try the non-resource path as fallback
        res = await self._api_request("PATCH", f"resource/consults/{consult_id}/{role}/{participant_id}/start")
        if not res:
            logger.info(f"Retrying start_consult without resource prefix for consult {consult_id}")
            res = await self._api_request("PATCH", f"consults/{consult_id}/{role}/{participant_id}/start")
        return res

    async def end_consult(self, consult_id: str, role: str, participant_id: str, notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
        payload = {"consult_notes": notes} if notes else {}
        res = await self._api_request("PATCH", f"resource/consults/{consult_id}/{role}/{participant_id}/end", json=payload)
        if not res:
            res = await self._api_request("PATCH", f"consults/{consult_id}/{role}/{participant_id}/end", json=payload)
        return res


    async def delete_consult(self, consult_id: str) -> Optional[Dict[str, Any]]:
        """
        Cancels the consult on the microservice.
        """
        payload = {"consult_status": "canceled", "active": False}
        # Try PATCH v3 resource path first (standard for Garuda cancellation)
        res = await self._api_request("PATCH", f"resource/consults/{consult_id}", json=payload)
        if not res:
             # Fallback to direct DELETE if PATCH is not supported for cancellation
             res = await self._api_request("DELETE", f"resource/consults/{consult_id}")
        return res

cureselect_client = CureSelectClient()
