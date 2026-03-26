from typing import List, Dict, Any, Optional
import uuid
import logging
import re
from datetime import datetime, timedelta
from app.models.billing import Invoice
from app.models.encounter import Encounter
from beanie import PydanticObjectId
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

# CPT Pricing Mapping in INR
CPT_PRICING = {
    "99203": 1000.0,
    "99204": 1500.0,
    "99205": 2000.0,
    "99212": 300.0,
    "99213": 500.0,
    "99214": 800.0,
    "99215": 1200.0,
    "93000": 500.0,  # ECG
    "94640": 300.0,  # Nebulizer
    "36415": 150.0,  # Blood draw
    "80053": 600.0,  # CMP
    "80061": 500.0,  # Lipid
    "85025": 300.0,  # CBC
}

DEFAULT_CPT_PRICE = 500.0
BASE_FACILITY_FEE = 250.0

class BillingService:
    async def generate_claim(self, encounter_id: str, soap_note: Any, encounter_obj: Optional[Encounter] = None) -> Dict:
        """
        Suggests ICD-10 and CPT codes based on SOAP note and generates invoice.
        The matching flow prioritizes clinical entities from the conversation.
        """
        try:
            from app.modules.ai.icd10_lookup import icd10_service
            codes = []
            
            # 1. Fetch clinical markers (symptoms/diagnoses)
            found_markers = []
            if soap_note:
                # Check top-level lists
                if hasattr(soap_note, 'extracted_symptoms') and soap_note.extracted_symptoms:
                    found_markers.extend(soap_note.extracted_symptoms)
                if hasattr(soap_note, 'extracted_diagnosis') and soap_note.extracted_diagnosis:
                    found_markers.extend(soap_note.extracted_diagnosis)
                
                # Fallback to nested dictionary fields if top-level lists are empty
                if not found_markers:
                    if isinstance(soap_note, dict):
                        found_markers.extend(soap_note.get('subjective', {}).get('symptoms') or [])
                        found_markers.append(soap_note.get('assessment', {}).get('primary_diagnosis') or "")
                    elif hasattr(soap_note, 'subjective') and soap_note.subjective:
                        found_markers.extend(soap_note.subjective.get('symptoms') or [])
                    
                    if hasattr(soap_note, 'assessment') and soap_note.assessment:
                        primary = soap_note.assessment.get('primary_diagnosis')
                        if primary: found_markers.append(primary)
            
            # 2. MATCH ICD-10 codes from markers (using the expanded icd10.csv database)
            seen_codes = set()
            for marker in found_markers:
                # Handle dictionary items or strings
                query = marker.get("name") if isinstance(marker, dict) else str(marker)
                matches = icd10_service.lookup(query, limit=1)
                if matches:
                    match = matches[0]
                    if match["code"] not in seen_codes:
                        codes.append({
                            "code": match["code"],
                            "description": match["description"],
                            "system": "ICD-10",
                            "confidence": match.get("confidence", 1.0)
                        })
                        seen_codes.add(match["code"])
            
            # 3. MATCH CPT codes from the conversational AI output
            ai_cpt_codes = []
            if soap_note:
                if hasattr(soap_note, 'billing') and soap_note.billing:
                    ai_cpt_codes = soap_note.billing.get('cpt_codes', [])
                elif isinstance(soap_note, dict) and soap_note.get('billing'):
                    ai_cpt_codes = soap_note.get('billing', {}).get('cpt_codes', [])

            # Get encounter to find existing info and patient context
            encounter = encounter_obj
            if not encounter:
                try:
                    from bson.objectid import ObjectId
                    from beanie import PydanticObjectId
                    if ObjectId.is_valid(str(encounter_id)):
                        if not isinstance(encounter_id, ObjectId):
                            encounter = await Encounter.get(PydanticObjectId(encounter_id))
                        else:
                            encounter = await Encounter.get(encounter_id)
                    else:
                        encounter = await Encounter.find_one(Encounter.id == encounter_id)
                except Exception as e:
                    logger.warning(f"Encounter lookup failed in BillingService: {e}")

            # If no AI codes in SOAP, check if encounter already has collected billing codes
            if not ai_cpt_codes and encounter and encounter.billing_codes:
                ai_cpt_codes = []
                for entry in encounter.billing_codes:
                    # ONLY include codes that are explicitly CPT or look like CPT (5 digits starting with 9)
                    code_val = entry.get("code") if isinstance(entry, dict) else str(entry)
                    system = entry.get("system") if isinstance(entry, dict) else ""
                    
                    # Filter: system must be CPT OR it must look like a CPT code (5 digits)
                    if system == "CPT" or (not system and re.match(r"^\d{5}$", code_val)):
                        ai_cpt_codes.append({
                            "code": code_val, 
                            "description": entry.get("description", "AI Suggested") if isinstance(entry, dict) else "AI Suggested", 
                            "reasoning": entry.get("reasoning", "Collected during encounter stream") if isinstance(entry, dict) else "Collected during encounter stream"
                        })

            # Add AI suggested CPT codes to the billing flow
            if ai_cpt_codes:
                for c in ai_cpt_codes:
                    if isinstance(c, dict) and c.get("code"):
                        codes.append({
                            "code": c["code"],
                            "description": c.get("description", "Office visit"),
                            "system": "CPT",
                            "confidence": 0.95,
                            "reasoning": c.get("reasoning", "Directly matched from conversation flow")
                        })
                    elif isinstance(c, str):
                         codes.append({
                            "code": c,
                            "description": "Office visit",
                            "system": "CPT",
                            "confidence": 0.90,
                            "reasoning": "Suggested during session"
                        })
            else:
                # Dynamic Fallback Flow logic: Use matched ICD-10 presence and transcript keywords
                transcript_lower = ""
                if encounter and encounter.transcript:
                    transcript_lower = " ".join([t.get("text", "").lower() for t in encounter.transcript])
                elif soap_note and hasattr(soap_note, 'raw_transcript'):
                    transcript_lower = soap_note.raw_transcript.lower()

                # Determine complexity
                is_new = any(k in transcript_lower for k in ["new patient", "first time", "initial visit"])
                is_high = any(k in transcript_lower for k in ["severe", "emergency", "acute", "hospital", "chest pain", "shortness of breath", "unconscious"])
                is_moderate_chronic = any(k in transcript_lower for k in ["hypertension", "diabetes", "chronic", "follow up"])
                
                icd_count = len([c for c in codes if c["system"] == "ICD-10"])

                if is_new:
                    if icd_count >= 2 or is_high:
                        code, desc = "99204", "Office visit, new patient, high complexity"
                    else:
                        code, desc = "99203", "Office visit, new patient, moderate complexity"
                else:
                    # Established patient
                    if icd_count >= 3 or is_high:
                        code, desc = "99215", "Office visit, established, high complexity"
                    elif icd_count >= 1 or is_moderate_chronic:
                        code, desc = "99214", "Office visit, established, moderate complexity"
                    elif icd_count == 0:
                        code, desc = "99212", "Office visit, established, minimal complexity"
                    else:
                        code, desc = "99212", "Office visit, established, minimal complexity"
                if icd_count > 0 or is_new or is_high:
                    codes.append({
                        "code": code, 
                        "description": desc, 
                        "system": "CPT",
                        "reasoning": f"Dynamic fallback based on {icd_count} diagnoses and complexity markers"
                    })
                else:
                    # Truly unknown - don't guess 99213
                    codes.append({
                        "code": "PENDING",
                        "description": "Complexity assessment pending",
                        "system": "CPT",
                        "reasoning": "No clinical markers found to determine billing level"
                    })

            # Calculate total amount based on specific CPT code pricing (in INR)
            # OVERALL BILLING Logic: Instead of summing, use the highest CPT price found.
            cpt_prices = []
            cpt_found = False
            
            logger.info(f"Billing calculation start. Found codes: {codes}")
            
            for code_entry in [c for c in codes if c["system"] == "CPT"]:
                code_val = str(code_entry["code"]).strip()
                if code_val != "PENDING":
                    price = CPT_PRICING.get(code_val, DEFAULT_CPT_PRICE)
                    cpt_prices.append(price)
                    cpt_found = True
            
            # Application of overall pricing logic: Max of CPTs OR base fee if no CPTs
            amount = max(cpt_prices) if cpt_found else BASE_FACILITY_FEE

            # Get encounter to find patient info
            encounter = None
            try:
                from bson.objectid import ObjectId
                from beanie import PydanticObjectId
                if ObjectId.is_valid(str(encounter_id)):
                    encounter = await Encounter.get(PydanticObjectId(encounter_id))
                else:
                    encounter = await Encounter.find_one(Encounter.id == encounter_id)
            except Exception as e:
                logger.warning(f"Encounter lookup failed in BillingService: {e}")
                
            # Create or update Invoice in database
            # Use dictionary syntax for queries to be safer with Beanie initialization
            invoice = await Invoice.find_one({"encounter_id": str(encounter_id)})
            if invoice:
                invoice.amount = amount
                invoice.status = "pending"
                if encounter:
                    invoice.patient_id = encounter.patient_id
                    invoice.patient_name = encounter.patient_name if hasattr(encounter, 'patient_name') else invoice.patient_name
                await invoice.save()
            else:
                invoice = Invoice(
                    patient_id=encounter.patient_id if encounter else "P123",
                    patient_name=encounter.patient_name if (encounter and hasattr(encounter, 'patient_name')) else "Anonymous Patient",
                    encounter_id=str(encounter_id),
                    amount=amount,
                    status="pending",
                    due_date=datetime.utcnow() + timedelta(days=30)
                )
                await invoice.insert()

            return {
                "invoice_id": str(invoice.id),
                "encounter_id": str(encounter_id),
                "billing_codes": codes,
                "total_amount": amount,
                "currency": "INR",
                "status": "pending",
                "success": True
            }
        except Exception as e:
            logger.exception(f"Billing claim generation failed: {e}")
            return {
                "success": False, 
                "error": str(e),
                "billing_codes": [{"code": "PENDING", "description": "Error during claim generation", "system": "CPT"}]
            }

billing_service = BillingService()
