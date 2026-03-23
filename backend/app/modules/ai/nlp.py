import openai
from app.core.config import settings

class MedicalNLP:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.client = openai.AsyncOpenAI(api_key=self.api_key) if self.api_key else None

    async def extract_entities(self, text: str):
        """Extracts medical symptoms, drugs, and diagnoses."""
        # Uses GPT-4o or Llama-3.1 via Groq
        return {
            "symptoms": [],
            "vitals_mentioned": [],
            "potential_dx": []
        }

medical_nlp = MedicalNLP()
