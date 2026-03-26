import unittest
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os

# Add backend to path for imports
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mock dependencies before importing the router
sys.modules["app.core.encryption"] = MagicMock(encrypt_bytes=lambda x: x, decrypt_bytes=lambda x: x)
mock_icd10 = MagicMock()
sys.modules["app.modules.ai.icd10_lookup"] = MagicMock(icd10_service=mock_icd10)

# Import AFTER mocking
from app.routes.summary import update_soap
from app.models.encounter import Encounter, SOAPNote

class TestUpdateSoapBilling(unittest.IsolatedAsyncioTestCase):
    @patch("app.routes.summary.Encounter")
    @patch("app.modules.automation.billing_service.billing_service")
    async def test_update_soap_persists_billing_data(self, mock_billing_service, mock_encounter_cls):
        # Setup
        # Use a real-looking ObjectId string to pass validation without mocking ObjectId
        encounter_id = "507f1f77bcf86cd799439011" 
        soap_note_data = {
            "subjective": {"history_of_present_illness": "Patient feels better"},
            "assessment": {"primary_diagnosis": "Recovering"}
        }
        soap_note = SOAPNote(**soap_note_data)
        
        mock_encounter = MagicMock(spec=Encounter)
        mock_encounter.id = encounter_id
        mock_encounter.save = AsyncMock()
        mock_encounter_cls.get = AsyncMock(return_value=mock_encounter)
        
        mock_billing_result = {
            "success": True,
            "invoice_id": "INV-123",
            "billing_codes": [{"code": "99214", "description": "Office visit"}],
            "total_amount": 800.0,
            "currency": "INR"
        }
        mock_billing_service.generate_claim = AsyncMock(return_value=mock_billing_result)
        
        # Execute
        # The route now expects a dictionary with soap_note, billing_codes, etc.
        request_wrapper = {
            "soap_note": soap_note.dict() if hasattr(soap_note, 'dict') else soap_note,
            "billing_codes": [],
            "patient_name": "Test Patient"
        }
        result = await update_soap(encounter_id, request_wrapper)
        
        # Verify
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["billing_amount"], 800.0)
        self.assertEqual(result["billing_currency"], "INR")
        self.assertEqual(result["invoice_id"], "INV-123")
        
        # Verify persistence on encounter object
        self.assertEqual(mock_encounter.billing_amount, 800.0)
        self.assertEqual(mock_encounter.billing_currency, "INR")
        self.assertEqual(mock_encounter.invoice_id, "INV-123")
        mock_encounter.save.assert_called_once()

if __name__ == "__main__":
    unittest.main()
