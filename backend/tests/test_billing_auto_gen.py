import unittest
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os
import asyncio

# Mock ICD10LookupService before importing anything that uses it
mock_icd10 = MagicMock()
mock_icd10.lookup.return_value = []
sys.modules["app.modules.ai.icd10_lookup"] = MagicMock(icd10_service=mock_icd10)

# Add backend to path for imports
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.modules.automation.billing_service import billing_service, CPT_PRICING, BASE_FACILITY_FEE

class TestBillingService(unittest.IsolatedAsyncioTestCase):
    async def test_generate_claim_with_cpt_codes(self):
        encounter_id = "6741b63c7c2b5c0012345678"
        soap_note = MagicMock()
        soap_note.billing = {"cpt_codes": [{"code": "99213", "description": "Test"}, {"code": "93000", "description": "Test"}]}
        
        # Mock Encounter lookup and Invoice insertion in the billing_service namespace
        with patch("app.modules.automation.billing_service.Encounter") as mock_encounter_cls, \
             patch("app.modules.automation.billing_service.Invoice") as mock_invoice_cls:
            
            mock_encounter = MagicMock()
            mock_encounter.patient_id = "P123"
            mock_encounter.patient_name = "Test Patient"
            mock_encounter.billing_codes = []
            
            mock_encounter_cls.get = AsyncMock(return_value=mock_encounter)
            mock_encounter_cls.find_one = AsyncMock(return_value=mock_encounter)
            
            mock_invoice = MagicMock()
            mock_invoice_cls.return_value = mock_invoice
            mock_invoice_cls.find_one = AsyncMock(return_value=None)
            mock_invoice.insert = AsyncMock()
            mock_invoice.save = AsyncMock()
            
            result = await billing_service.generate_claim(encounter_id, soap_note)
            
            self.assertTrue(result["success"])
            # Highest CPT price (Overall Billing)
            # 99213 (500) and 93000 (500) -> Max is 500
            self.assertEqual(result["total_amount"], 500.0)
            self.assertEqual(result["currency"], "INR")

    async def test_generate_claim_no_codes_base_fee(self):
        encounter_id = "6741b63c7c2b5c0012345678"
        soap_note = None 
        
        with patch("app.modules.automation.billing_service.Encounter") as mock_encounter_cls, \
             patch("app.modules.automation.billing_service.Invoice") as mock_invoice_cls:
            
            mock_encounter = MagicMock()
            mock_encounter.patient_id = "P123"
            mock_encounter.patient_name = "Test Patient"
            mock_encounter.billing_codes = []
            mock_encounter.transcript = []
            
            mock_encounter_cls.get = AsyncMock(return_value=mock_encounter)
            mock_encounter_cls.find_one = AsyncMock(return_value=mock_encounter)
            
            mock_invoice = MagicMock()
            mock_invoice_cls.return_value = mock_invoice
            mock_invoice_cls.find_one = AsyncMock(return_value=None)
            mock_invoice.insert = AsyncMock()
            mock_invoice.save = AsyncMock()
            
            result = await billing_service.generate_claim(encounter_id, soap_note)
            
            self.assertTrue(result["success"])
            self.assertEqual(result["total_amount"], BASE_FACILITY_FEE)
            self.assertEqual(result["currency"], "INR")

if __name__ == "__main__":
    unittest.main()
