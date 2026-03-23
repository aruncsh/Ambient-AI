from typing import List, Dict, Any
import uuid

class BillingService:
    async def generate_claim(self, encounter_id: str, soap_note: Any) -> Dict:
        """
        Suggests ICD-10 and CPT codes based on SOAP note and generates invoice.
        """
        # Improved coding logic mapping text to common ICD-10 codes
        codes = []
        
        mapping = {
            "Cough": {"code": "R05.9", "description": "Cough, unspecified", "system": "ICD-10"},
            "Pain": {"code": "R52", "description": "Pain, unspecified", "system": "ICD-10"},
            "Chest Pain": {"code": "R07.9", "description": "Chest pain, unspecified", "system": "ICD-10"},
            "Fever": {"code": "R50.9", "description": "Fever, unspecified", "system": "ICD-10"},
            "Bronchitis": {"code": "J20.9", "description": "Acute bronchitis, unspecified", "system": "ICD-10"},
            "Diabetes": {"code": "E11.9", "description": "Type 2 diabetes without complications", "system": "ICD-10"},
            "Hypertension": {"code": "I10", "description": "Essential hypertension", "system": "ICD-10"},
            "Asthma": {"code": "J45.909", "description": "Unspecified asthma, uncomplicated", "system": "ICD-10"},
            "Infection": {"code": "B99.9", "description": "Unspecified infectious disease", "system": "ICD-10"}
        }

        # Analyze extracted symptoms and diagnosis
        found_markers = []
        if soap_note:
            found_markers = (soap_note.extracted_symptoms if soap_note.extracted_symptoms else []) + \
                            (soap_note.extracted_diagnosis if soap_note.extracted_diagnosis else [])
        
        for marker in found_markers:
            for key, val in mapping.items():
                if key.lower() in marker.lower():
                    codes.append(val)
        
        # Default E/M code if nothing specific found
        if not codes:
            codes.append({"code": "99213", "description": "Office visit, low complexity", "system": "CPT"})
        else:
            # Add moderate complexity visit if we found multiple issues
            codes.append({"code": "99214", "description": "Office visit, moderate complexity", "system": "CPT"})

        return {
            "invoice_id": f"INV-{str(uuid.uuid4().hex)[:6].upper()}",
            "encounter_id": encounter_id,
            "billing_codes": codes,
            "total_amount": 150.00 + (len(codes) * 25.0),
            "currency": "USD",
            "status": "draft",
            "success": True
        }

billing_service = BillingService()
