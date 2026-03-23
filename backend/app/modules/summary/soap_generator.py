from app.modules.ai.fusion import ai_fusion
from app.models.soap_summary import SOAPSummary
from app.core.encryption import encrypt_data
import logging

logger = logging.getLogger(__name__)

class SOAPGenerator:
    async def generate(self, encounter_id: str, fused_data: dict):
        """Generates a structured SOAP note from fused AI data."""
        # HIPAA: Encrypt the final note
        note_content = f"S: {fused_data['transcript']}\nO: Vitals stable. {fused_data['visual_cues']}\nA: {fused_data['entities']['potential_dx']}\nP: Follow up in 1 week."
        
        logger.info(f"Generating SOAP note for encounter {encounter_id}")
        
        soap = await SOAPSummary(
            encounter_id=encounter_id,
            subjective=fused_data["transcript"],
            objective=f"Vitals: {fused_data['vitals']}",
            assessment=str(fused_data["entities"]["potential_dx"]),
            plan="Observation and follow-up.",
            encrypted_note=encrypt_data(note_content)
        ).insert()
        
        return soap

soap_generator = SOAPGenerator()
