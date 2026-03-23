from typing import Dict, Any, List
import aiohttp
import os
import logging
from app.models.encounter import Encounter

logger = logging.getLogger(__name__)

class FHIRService:
    def __init__(self):
        self.base_url = os.getenv("FHIR_URL", "http://fhir-mock:8080")

    def _flatten_soap_section(self, section_input) -> str:
        if isinstance(section_input, str):
            return section_input
        if isinstance(section_input, dict):
            parts = []
            for k, v in section_input.items():
                k_title = k.replace("_", " ").title()
                if isinstance(v, list):
                    parts.append(f"{k_title}: {', '.join(map(str, v))}")
                elif isinstance(v, dict):
                    sub_parts = [f"{sk}: {sv}" for sk, sv in v.items()]
                    parts.append(f"{k_title}: {'; '.join(sub_parts)}")
                else:
                    parts.append(f"{k_title}: {v}")
            return " | ".join(parts)
        return str(section_input)

    async def sync_encounter(self, encounter: Encounter) -> Dict:
        """
        Syncs encounter data to a mock EHR via FHIR API mapping.
        """
        try:
            soap = encounter.soap_note
            if not soap:
                return {"success": False, "error": "No SOAP note to sync"}
            
            fhir_bundle: Dict[str, Any] = {
                "resourceType": "Bundle",
                "type": "transaction",
                "entry": [
                    {
                        "resource": {
                            "resourceType": "Encounter",
                            "status": "finished",
                            "class": {"code": "AMB", "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode"},
                            "subject": {"reference": f"Patient/{encounter.patient_id}"},
                            "period": {
                                "start": encounter.created_at.isoformat() if encounter.created_at else None,
                                "end": encounter.updated_at.isoformat() if encounter.updated_at else None
                            }
                        }
                    },
                    {
                        "resource": {
                            "resourceType": "DocumentReference",
                            "status": "current",
                            "type": {"text": "Clinical Note (SOAP)"},
                            "subject": {"reference": f"Patient/{encounter.patient_id}"},
                            "content": [{
                                "attachment": {
                                    "contentType": "text/plain",
                                    "data": f"S: {self._flatten_soap_section(soap.subjective)}\nO: {self._flatten_soap_section(soap.objective)}\nA: {self._flatten_soap_section(soap.assessment)}\nP: {self._flatten_soap_section(soap.plan)}"
                                }
                            }]
                        }
                    }
                ]
            }

            entries: List[Dict[str, Any]] = fhir_bundle["entry"]

            # Add Diagnosis as Condition resources
            for condition in soap.extracted_diagnosis:
                entries.append({
                    "resource": {
                        "resourceType": "Condition",
                        "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]},
                        "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "provisional"}]},
                        "code": {"text": str(condition)},
                        "subject": {"reference": f"Patient/{encounter.patient_id}"}
                    }
                })

            # Sync Vitals as Observations
            if encounter.vitals:
                for key, val in encounter.vitals.items():
                    entries.append({
                        "resource": {
                            "resourceType": "Observation",
                            "status": "final",
                            "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
                            "code": {"text": str(key)},
                            "valueQuantity": {"value": val},
                            "subject": {"reference": f"Patient/{encounter.patient_id}"}
                        }
                    })

            # Sync Prescriptions as MedicationRequest
            for rx in encounter.prescriptions:
                entries.append({
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "status": "active",
                        "intent": "order",
                        "medicationCodeableConcept": {"text": rx.get("medication", "Unknown")},
                        "subject": {"reference": f"Patient/{encounter.patient_id}"},
                        "dosageInstruction": [{"text": rx.get("dosage", "As directed")}]
                    }
                })

            logger.info(f"Syncing FHIR Bundle for patient {encounter.patient_id} to {self.base_url}")
            # Mock sync response
            return {
                "fhir_id": f"fhir-{os.urandom(4).hex()}",
                "status": "synced",
                "synced_resources": len(fhir_bundle["entry"]),
                "timestamp": encounter.updated_at.isoformat() if encounter.updated_at else None,
                "success": True
            }
        except Exception as e:
            logger.error(f"EHR Sync failed: {e}")
            return {"success": False, "error": str(e)}

    async def order_lab_tests(self, patient_id: str, tests: list) -> Dict:
        """Orders labs/imaging via EHR integration."""
        return {
            "order_ids": [f"ORD-{i}" for i in range(len(tests))],
            "status": "placed",
            "tests": tests,
            "success": True
        }

fhir_service = FHIRService()
