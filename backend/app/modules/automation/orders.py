import logging
from typing import List, Dict
from app.modules.ai.medical_nlp import medical_nlp_service

logger = logging.getLogger(__name__)

class OrderAutomation:
    def _get_plan_text(self, plan_input) -> str:
        if isinstance(plan_input, str):
            return plan_input
        if isinstance(plan_input, dict):
            # Flatten dict into a searchable string
            parts = []
            for k, v in plan_input.items():
                k_title = str(k).replace("_", " ").title()
                if isinstance(v, list):
                    parts.append(f"{k_title}: {', '.join(map(str, v))}")
                elif isinstance(v, dict):
                    sub_parts = [f"{sk}: {sv}" for sk, sv in v.items()]
                    parts.append(f"{k_title}: {'; '.join(sub_parts)}")
                else:
                    parts.append(f"{k_title}: {v}")
            return "\n".join(parts)
        return str(plan_input)

    async def generate_prescriptions(self, plan_input) -> List[Dict]:
        """Generates structured prescriptions based on the treatment plan using AI extraction."""
        if not plan_input:
            return []
            
        plan_text = self._get_plan_text(plan_input)
        
        # In production, we use the LLM to Parse the plan text into structured MedicationRequest objects
        try:
            prescriptions = await medical_nlp_service.extract_structured_prescriptions(plan_text)
            if prescriptions:
                logger.info(f"AI extracted {len(prescriptions)} prescriptions from plan.")
                return prescriptions
        except Exception as e:
            logger.error(f"AI prescription extraction failed: {e}")

        # Fallback to extremely basic parsing if AI fails
        prescriptions = []
        if isinstance(plan_input, dict) and "medications" in plan_input:
            for med_str in plan_input["medications"]:
                prescriptions.append({"medication": med_str, "dosage": "As directed", "route": "PO", "frequency": "Daily"})
        
        return prescriptions

    async def generate_lab_orders(self, plan_input) -> List[Dict]:
        """Generates structured lab orders based on the treatment plan using AI extraction."""
        if not plan_input:
            return []

        plan_text = self._get_plan_text(plan_input)
        
        try:
            orders = await medical_nlp_service.extract_structured_lab_orders(plan_text)
            if orders:
                logger.info(f"AI extracted {len(orders)} lab orders from plan.")
                return orders
        except Exception as e:
            logger.error(f"AI lab order extraction failed: {e}")

        # Fallback
        orders = []
        if isinstance(plan_input, dict) and "diagnostic_tests" in plan_input:
            for test_str in plan_input["diagnostic_tests"]:
                orders.append({"test_name": test_str, "status": "ordered", "priority": "routine"})
        
        return orders

order_automation = OrderAutomation()
