class OrderAutomation:
    def _get_plan_text(self, plan_input) -> str:
        if isinstance(plan_input, str):
            return plan_input
        if isinstance(plan_input, dict):
            # Flatten dict into a searchable string
            parts = []
            for k, v in plan_input.items():
                if isinstance(v, list):
                    parts.append(f"{k}: {', '.join(map(str, v))}")
                else:
                    parts.append(f"{k}: {v}")
            return "\n".join(parts)
        return str(plan_input)

    async def generate_prescriptions(self, plan_input):
        """Generates mock prescriptions based on the treatment plan."""
        prescriptions = []
        plan_text = self._get_plan_text(plan_input)
        plan_lower = plan_text.lower()
        
        if "pain" in plan_lower or "ibuprofen" in plan_lower or "antiplatelet" in plan_lower:
            prescriptions.append({"medication": "Ibuprofen", "dosage": "400mg", "route": "PO", "frequency": "Every 6 hours PRN"})
        
        if "infec" in plan_lower or "antibiotic" in plan_lower or "statin" in plan_lower:
            prescriptions.append({"medication": "Amoxicillin", "dosage": "500mg", "route": "PO", "frequency": "Three times daily for 7 days"})

        if not prescriptions:
            # Default fallback for demonstration
            prescriptions.append({"medication": "Consultation Follow-up", "dosage": "N/A", "route": "N/A", "frequency": "N/A"})
            
        return prescriptions

    async def generate_lab_orders(self, plan_input):
        """Generates mock lab orders based on the treatment plan."""
        orders = []
        plan_text = self._get_plan_text(plan_input)
        plan_lower = plan_text.lower()
        
        if "heart" in plan_lower or "chest" in plan_lower or "cardio" in plan_lower or "ecg" in plan_lower or "angina" in plan_lower:
            orders.extend(["Troponin I", "12-Lead ECG", "Echocardiogram"])
        
        if "blood" in plan_lower or "infection" in plan_lower or "fever" in plan_lower:
            orders.append("Complete Blood Count (CBC) with Differential")
            orders.append("Basic Metabolic Panel (BMP)")
            
        if "sugar" in plan_lower or "diabet" in plan_lower:
            orders.append("Hemoglobin A1c")
            
        if "imaging" in plan_lower or "x-ray" in plan_lower or "mri" in plan_lower:
            orders.append("Chest X-Ray (PA and Lateral)")
            
        if not orders:
            orders.append("General Wellness Panel")
            
        return orders

order_automation = OrderAutomation()
