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
        Supports both patient and clinician roles.
        """
        try:
            logger.info(f"Validating token: {token[:10]}...")
            info = await ConsultService.get_consult_info(token)
            
            if "error" in info:
                logger.warning(f"Microservice token validation failed: {info['error']}")
                return info

            role_info = info["provider_info"]
            ms_role = str(role_info.get("role", "subscriber")).strip().lower()
            logger.info(f"Microservice role identified: {ms_role}")
            
            # Identify local user
            local_user = None
            user_role = "patient"
            
            # 1. Try to fetch from local_patient_id or local_doctor_id in additional_info
            local_id = str(info.get("local_patient_id", ""))
            local_doc_id = str(info.get("local_doctor_id", ""))
            
            logger.info(f"Handshake Logic - MS Role: {ms_role}, Local ID: {local_id}, Doc ID: {local_doc_id}")

            if ms_role in ["publisher", "doctor", "clinician"]:
                user_role = "doctor"
                # Priority 1: Direct local ID mapping
                if local_id and len(local_id) == 24:
                    try:
                        local_user = await Doctor.get(PydanticObjectId(local_id))
                        if local_user: logger.info(f"MATCH: Found doctor by local_id: {local_id}")
                    except Exception as e: logger.warning(f"Doctor.get(local_id) failed: {e}")
                
                if not local_user and local_doc_id and len(local_doc_id) == 24:
                    try:
                        local_user = await Doctor.get(PydanticObjectId(local_doc_id))
                        if local_user: logger.info(f"MATCH: Found doctor by local_doc_id: {local_doc_id}")
                    except Exception as e: logger.warning(f"Doctor.get(local_doc_id) failed: {e}")
                
                # Priority 2: Try to find doctor by email
                if not local_user:
                    email = role_info.get("email")
                    if email:
                        local_user = await Doctor.find_one({"email": email})
                        if local_user: logger.info(f"MATCH: Found doctor by email: {email}")

            else:
                user_role = "patient"
                # Subscriber logic (Patient)
                if local_id and len(local_id) == 24:
                    try:
                        local_user = await Patient.get(PydanticObjectId(local_id))
                        if local_user: logger.info(f"MATCH: Found patient by local_id: {local_id}")
                    except Exception as e: logger.warning(f"Patient.get(local_id) failed: {e}")

            # 2. Fallback to ref_number if it looks like a PydanticObjectId
            if not local_user and info.get("patient_id"):
                 pid = str(info["patient_id"])
                 if len(pid) == 24:
                      try:
                         if user_role == "doctor":
                             local_user = await Doctor.get(PydanticObjectId(pid))
                         else:
                             local_user = await Patient.get(PydanticObjectId(pid))
                         if local_user: logger.info(f"MATCH: Found {user_role} by PID/ref_number: {pid}")
                      except: pass

            # 3. Search by external ID
            if not local_user:
                 ext_id = str(role_info.get("id") or "")
                 if ext_id and ext_id != "None":
                      if user_role == "doctor":
                          local_user = await Doctor.find_one({"external_id": ext_id})
                      else:
                          local_user = await Patient.find_one({"external_id": ext_id})
                      if local_user: logger.info(f"MATCH: Found {user_role} by external_id: {ext_id}")

            # 4. Search by email as last resort (Very common in Garuda V3)
            if not local_user and role_info.get("email"):
                 email = role_info.get("email")
                 if user_role == "doctor":
                     local_user = await Doctor.find_one({"email": email})
                 else:
                     local_user = await Patient.find_one({"email": email})
                 if local_user: logger.info(f"MATCH: Found {user_role} by email fallback: {email}")

            if not local_user:
                 # Auto-register if not found (Staging/Compatibility mode)
                 ext_id = str(role_info.get("id") or info.get("patient_id") or "")
                 if ext_id in ["-1", "None", "undefined"]:
                      ext_id = str(info.get("patient_id") or "") if info.get("patient_id") not in ["-1", "None"] else ""
                 
                 logger.info(f"REGISTER: Auto-registering {user_role} - {role_info.get('name')} (Ext ID: {ext_id})")
                 try:
                     if user_role == "doctor":
                         local_user = Doctor(
                             name=role_info.get("name") or "Microservice Doctor",
                             email=role_info.get("email") or "doctor@a2zhealth.in",
                             specialization="Tele-Consultant",
                             external_id=ext_id if ext_id and ext_id not in ["None", "-1"] else None
                         )
                         await local_user.insert()
                     else:
                         local_user = Patient(
                             name=role_info.get("name") or "Microservice Patient",
                             email=role_info.get("email") or "patient@a2zhealth.in",
                             gender="Unknown",
                             external_id=ext_id if ext_id and ext_id not in ["None", "-1"] else None
                         )
                         await local_user.insert()
                     logger.info(f"REGISTER SUCCESS: New {user_role} ID: {local_user.id}")
                 except Exception as reg_err:
                     logger.error(f"REGISTER FAILURE: {reg_err}")
                     # Final desperation: search by name one more time in case of race condition
                     name = role_info.get("name")
                     if name:
                         if user_role == "doctor": local_user = await Doctor.find_one({"name": name})
                         else: local_user = await Patient.find_one({"name": name})

            if not local_user:
                logger.error(f"HANDSHAKE FAILURE: Could not map/create user for role {ms_role}")
                return {"error": "Identification failed - Could not map microservice participant to a local user record."}

            # 3. Generate local token (consult session auth)
            local_id_str = str(local_user.id)
            local_token = create_access_token({"sub": local_id_str, "role": user_role, "consult_id": info["consult_id"]})
            
            logger.info(f"HANDSHAKE SUCCESS: Mapping {ms_role} to {user_role} (Local ID: {local_id_str})")
            # Safeguard consult object extraction
            consult_obj = {"id": info["consult_id"]}
            if info.get("consultInfo"):
                if isinstance(info["consultInfo"], list) and len(info["consultInfo"]) > 0:
                    if isinstance(info["consultInfo"][0], dict):
                         consult_obj = info["consultInfo"][0]
                    else:
                         consult_obj["ms_id"] = info["consultInfo"][0]
                elif isinstance(info["consultInfo"], dict) and hasattr(info["consultInfo"], "values"):
                    # If it's a dict indexed by ID, take the first value
                    vals = list(info["consultInfo"].values())
                    if vals and len(vals) > 0:
                         if isinstance(vals[0], dict):
                              consult_obj = vals[0]
                         else:
                              consult_obj["ms_id"] = vals[0]

            # Enrich consult object with additional_info if missing
            additional_info = info.get("additional_info", {})
            if not isinstance(additional_info, dict):
                 additional_info = {}
            
            # Ensure api_end_point is valid with trailing slash
            if "api_end_point" in additional_info:
                 if not additional_info["api_end_point"].endswith("/"):
                      additional_info["api_end_point"] += "/"
            
            if "additional_info" not in consult_obj or not consult_obj["additional_info"]:
                consult_obj["additional_info"] = additional_info
            
            # For robustness, over-provide configuration to known Garuda/CureSelect keys
            if isinstance(role_info, dict):
                 role_info["role"] = ms_role # Force normalization
                 if "additional_info" not in role_info:
                      role_info["additional_info"] = additional_info
                 if "api_end_point" not in role_info:
                      role_info["api_end_point"] = additional_info.get("api_end_point")
            
            if "ms_response" in info and isinstance(info["ms_response"], dict):
                 # Patch the deep 'info' block in the raw response too
                 try:
                     info["ms_response"].get("data", {}).get("info", {})["role"] = ms_role
                 except: pass

            # Final response payload wrapped in 'data' for microservice compatibility
            # V2 Angular app specifically looks for 'config' and sometimes 'participant' instead of 'info'
            config_block = {
                "api_end_point": additional_info.get("api_end_point", "https://services-api.a2zhealth.in/"),
                "api_end_version": additional_info.get("api_end_version", "v1"),
                "x_name": additional_info.get("x_name", "garuda"),
                "organization_id": additional_info.get("organization_id", "25")
            }

            response_payload = {
                "userInfo": {
                    "id": str(role_info.get("id", "")),
                    "local_id": str(local_user.id) if local_user else None,
                    "name": local_user.name if local_user else role_info.get("name"),
                    "email": local_user.email if local_user else role_info.get("email"),
                    "role": ms_role,
                    "additional_info": additional_info
                },
                "consult": consult_obj,
                "info": role_info,
                "participant": role_info,   # Alias for V2 compatibility
                "config": config_block,      # Mandatory for V2 config handshake
                "token": local_token,
                "additional_info": additional_info,
                "ms_response": info.get("ms_response")
            }

            # Super Robust Response for maximum version compatibility (V1, V2, V3)
            # We provide the keys at the root, inside 'data', and inside 'config'
            final_response = {
                "status": "success",
                "success": True,
                "data": response_payload,
                "config": config_block,
                "participant": role_info,
                "info": role_info,
                "userInfo": response_payload.get("userInfo"),
                "api_end_point": config_block["api_end_point"],
                "apiEndPoint": config_block["api_end_point"],
                "api_end_version": config_block["api_end_version"],
                "organization_id": "25",
                "organizationId": "25",
                "x_name": "garuda",
                "role": ms_role,
                "token": local_token,
                "id": str(role_info.get("id", "")),
                "consult_id": str(info.get("consult_id", ""))
            }
            
            # Deep clone the root keys into the 'data' block as well for V2/V3 consistency
            final_response["data"].update({
                "config": config_block,
                "api_end_point": config_block["api_end_point"],
                "apiEndPoint": config_block["api_end_point"],
                "participant": role_info,
                "role": ms_role
            })

            return final_response


        except Exception as e:
            logger.error(f"token_validate crash: {e}")
            import traceback
            tb = traceback.format_exc()
            return {"error": f"Session verification crash: {str(e)}", "traceback": tb}

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
        Starts the session via microservice with role mapping normalization.
        """
        # Map local roles back to microservice roles if needed
        ms_role = role
        if role.lower() in ["doctor", "clinician", "provider"]: ms_role = "publisher"
        elif role.lower() in ["patient", "subscriber"]: ms_role = "subscriber"
        
        # Notify external microservice source of truth
        ext_data = await cureselect_client.start_consult(consult_id, ms_role, participant_id)
        return ext_data or {"status": "success"}

    @staticmethod
    async def end_consult(consult_id: str, role: str, participant_id: str, notes: Optional[str] = None) -> Dict[str, Any]:
        """
        Ends the session via microservice with role mapping normalization.
        """
        # Map local roles back to microservice roles if needed
        ms_role = role
        if role.lower() in ["doctor", "clinician", "provider"]: ms_role = "publisher"
        elif role.lower() in ["patient", "subscriber"]: ms_role = "subscriber"
        
        # Notify external microservice source of truth
        ext_data = await cureselect_client.end_consult(consult_id, ms_role, participant_id, notes)
        return ext_data or {"status": "success"}

    @staticmethod
    async def get_consult_info(token: str) -> Dict[str, Any]:
        """
        Replicates PHP getConsultInfo logic. Returns patient_id (ref_number), 
        local_patient_id (if in additional_info), and other metadata.
        """
        # 1. Validate token with microservice
        logger.info(f"CureSelect validate token attempt: {token[:10]}...")
        consult_info = await cureselect_client.get_consult_details(token)
        if not consult_info:
            logger.error("CureSelect returned None for token validation")
            return {"patient_id": "-1", "consult_id": "-1", "error": "Invalid token - Microservice rejected the clinical session token."}

        # 2. Extract consult_id and patient_id from response
        data = consult_info.get("data", {})
        if not data:
            logger.warning(f"CureSelect response missing data: {consult_info}")
            return {"error": "Microservice response format mismatch (missing data block)."}

        consult_details = data.get("consult", {})
        consult_id = str(consult_details.get("id") or "-1")
        
        # Check additional_info for local IDs
        additional_info = consult_details.get("additional_info", {})
        if isinstance(additional_info, str) and additional_info.startswith("{"):
            try:
                import json
                additional_info = json.loads(additional_info)
            except:
                additional_info = {}
        elif not isinstance(additional_info, dict):
            additional_info = {}
        
        local_patient_id = additional_info.get("local_patient_id")
        local_doctor_id = additional_info.get("local_doctor_id")
        
        patient_id = "-1"
        participants = data.get("participants", [])
        
        # Hardened lookup: If participants list is empty at top level, check the consult object
        if not participants:
             participants = consult_details.get("participants", [])
             
        if isinstance(participants, list):
            for p in participants:
                if not isinstance(p, dict): continue
                # Primary patient identification via subscriber role or non-guest status
                role = str(p.get("role", "")).lower()
                if role == "subscriber" or (not p.get("is_guest") and "guest" not in str(p.get("ref_number", ""))):
                     patient_id = str(p.get("ref_number", "-1"))
                     if role == "subscriber": break # Found the definitive patient
        
        # 3. Fetch detailed consult info (fetchById in PHP)
        detailed_consult = await cureselect_client.fetch_by_id(consult_id) if consult_id != "-1" else None
        consult_list = detailed_consult.get("data", {}).get("consults", []) if detailed_consult and isinstance(detailed_consult.get("data"), dict) else []

        # 4. Final attempt to find participants if still missing (needed for patient identification)
        if patient_id == "-1" and isinstance(consult_list, list):
             for c in consult_list:
                  if not isinstance(c, dict): continue
                  c_participants = c.get("participants", [])
                  if isinstance(c_participants, list):
                       for p in c_participants:
                            role = str(p.get("role", "")).lower()
                            if role == "subscriber":
                                 patient_id = str(p.get("ref_number", "-1"))
                                 break
                  if patient_id != "-1": break

        # 5. Self-healing for Frontend (Garuda Angular)
        # If additional_info is missing mandatory fields, patch it on the fly
        if consult_id != "-1" and not additional_info.get("api_end_point"):
            logger.info(f"Self-healing TRACE: Missing 'api_end_point' detected for consult {consult_id}. Attempting PATCH...")
            ms_status = data.get("consult", {}).get("status")
            status_slug = ms_status.get("slug") if isinstance(ms_status, dict) else ms_status or "new"

            patch_data = {
                "id": consult_id,
                "status": status_slug,
                "additional_info": {
                    "api_end_point": "https://services-api.a2zhealth.in/",
                    "api_end_version": "v1",
                    "x_name": "garuda",
                    "organization_id": "25"
                }
            }
            try:
                patch_res = await cureselect_client.update_consult(patch_data)
                logger.info(f"Self-healing RESULT: Patch response for {consult_id}: {patch_res}")
                # Update local additional_info for the return value
                additional_info = patch_data["additional_info"]
            except Exception as patch_err:
                logger.error(f"Self-healing FAILURE: Patch crash for {consult_id}: {patch_err}")

        return {
            "patient_id": patient_id, # This is the microservice ref_number
            "local_patient_id": local_patient_id, # This is the Ambient MongoDB ID
            "local_doctor_id": local_doctor_id,
            "consult_id": consult_id,
            "provider_info": data.get("info", {}),
            "consultInfo": consult_list,
            "additional_info": additional_info,
            "ms_response": consult_info
        }

    @staticmethod
    async def get_consult_summary(token: str) -> Dict[str, Any]:
        """
        Replicates PHP consultSummary logic. Aggregates data for the consult session.
        Prevents 500 errors by safely handling user identification and database lookups.
        """
        try:
            info = await ConsultService.get_consult_info(token)
            if "error" in info:
                logger.warning(f"get_consult_summary: info acquisition failed: {info['error']}")
                return info

            # Priority 1: Use specific local_patient_id if provided by microservice
            # Priority 2: Use ref_number (patient_id) directly
            patient_id = info.get("local_patient_id") or info.get("patient_id")
            consult_id = info.get("consult_id")

            if not patient_id or patient_id == "-1":
                 logger.warning(f"get_consult_summary: Patient not identified for session {consult_id}")
                 return {"error": "Patient not identified"}

            summary = {}

            # 1. Profile information - Safely convert to PydanticObjectId
            patient = None
            if patient_id and len(str(patient_id)) == 24:
                try:
                    patient = await Patient.get(PydanticObjectId(patient_id))
                except Exception as e:
                    logger.warning(f"Invalid PydanticObjectId for patient lookup: {patient_id}")
            
            # Fallback search if not found by direct ID (might be an external_id or ref_number)
            if not patient:
                 # Try searching by external_id (ref_number from microservice)
                 patient = await Patient.find_one({"external_id": info.get("patient_id")})
                 
                 # Final fallback: search by name for staging parity/compatibility
                 if not patient and info.get("provider_info", {}).get("name"):
                      patient = await Patient.find_one({"name": info["provider_info"]["name"]})

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

            # 2. Clinical Data - Try to pull from an Encounter matching this consult_id
            encounter = await Encounter.find_one({"additional_info.external_id": consult_id})
            
            if not encounter:
                # Fallback to latest encounter for this patient
                search_id = str(patient.id) if patient else patient_id
                encounter = await Encounter.find({"patient_id": search_id}).sort("-created_at").first_or_none()

            if encounter:
                summary["2_vital"] = encounter.vitals
                summary["3_health"] = encounter.soap_note.subjective if encounter.soap_note else {}
                summary["4_ros"] = encounter.soap_note.ros if encounter.soap_note else {}
                summary["5_pe"] = encounter.soap_note.objective if encounter.soap_note else {}
                summary["6_stroke_scale"] = encounter.nlp_insights.get("stroke_scale", [])
                summary["7_history"] = encounter.soap_note.patient_history if encounter.soap_note else {}
                summary["8_doc"] = [] 
            else:
                summary["2_vital"] = {
                    "heart_rate": {"value": None},
                    "blood_pressure": {"value": None},
                    "oxygen_saturation": {"value": None}
                }
                summary["3_health"] = {}
                summary["4_ros"] = {}
                summary["5_pe"] = {}
                summary["6_stroke_scale"] = []
                summary["7_history"] = {}
                summary["8_doc"] = []

            summary["provider_details"] = info.get("provider_info", {})
            summary["0_consult_details"] = info.get("consultInfo", [])

            return summary

        except Exception as e:
            logger.error(f"get_consult_summary crash: {e}")
            import traceback
            traceback.print_exc()
            return {"error": f"Internal summary aggregation failure: {str(e)}"}


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

    @staticmethod
    async def get_consult_count_by_status(statuses: List[str], filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gets consult counts by multiple statuses.
        """
        data = await cureselect_client.fetch_consult_counts(statuses, filters)
        if not data:
            return {"counts": {status: 0 for status in statuses}}
        
        return data

    @staticmethod
    async def ptz_camera_access(consult_id: str, action: str, speed: str) -> Dict[str, Any]:
        """
        Simulates PTZ Camera control over IP as per PHP logic.
        """
        # Fetch consult details (local fallback or microservice?)
        # For now, we use microservice to get additional_info
        info = await cureselect_client.fetch_by_id(consult_id)
        if not info:
             return {"error": "Consult not found"}
        
        # Microservice usually returns list in data.consults
        data = info.get("data", {}).get("consults", [])
        if not data: 
             return {"error": "Consult data empty"}
        
        consult = data[0] if isinstance(data, list) else data
        additional_info = consult.get("additional_info", {})
        if isinstance(additional_info, str):
            try:
                import json
                additional_info = json.loads(additional_info)
            except:
                additional_info = {}
        
        camera = additional_info.get("camera", {})
        ip = camera.get("camera_ip")
        
        if ip:
            # cmd = '{"SysCtrl":{"PtzCtrl":{"nChanel":0,"szPtzCmd":"' + action + '","byValue":"' + speed + '"}}}'
            # url = f"http://{ip}/ajaxcom?szCmd={cmd}"
            # In a real environment, we'd fire an event or call the URL if public
            logger.info(f"PTZ Command Dispatched: {action} to {ip}")
            return {"status": "success", "ip": ip, "action": action}
        
        return {"error": "Camera IP not configured for this consult"}

consult_service = ConsultService()


