import logging
import json
import httpx
from typing import Dict, List, Optional
import openai
from app.core.config import settings

logger = logging.getLogger(__name__)

CLINICAL_SUGGESTION_PROMPT = """
You are a real-time AI clinical decision support assistant running alongside a physician.

Your job is to analyze the ongoing doctor-patient conversation and provide concise, actionable support.

OUTPUT FORMAT (strict JSON):
{
  "differential_diagnoses": ["<diagnosis 1>", "<diagnosis 2>"],
  "suggested_questions": ["<question to ask patient>"],
  "red_flags": ["<any alarming symptom or sign>"],
  "suggested_tests": ["<relevant lab or imaging test>"],
  "clinical_notes": "<brief clinical reasoning or reminder>"
}

RULES:
- Be concise. Maximum 3 items per list.
- Base suggestions ONLY on what is mentioned in the transcript.
- If no symptoms are discussed, return empty lists.
- Output MUST be valid JSON only.
- Translate any non-English text to English before reasoning.

TRANSCRIPT:
{transcript}

OUTPUT:
"""

GENERAL_CHAT_SYSTEM_PROMPT = """
You are an intelligent AI assistant specialized in medicine and healthcare.
You can help with:
- Medical questions and explanations
- Drug information and interactions
- Clinical guidelines and best practices
- General health advice
- Non-medical topics as well

Be concise, accurate, and professional. Always recommend consulting a doctor for personal medical decisions.
Output plain text. Do not use markdown headers.
"""


class ClinicalAssistantService:
    """
    Provides real-time clinical decision support and general AI chat capabilities.
    Works with OpenAI, Groq, or local Ollama — free and with no limitations when Ollama is running.
    """

    def __init__(self):
        self.client = None
        self.ollama_url = settings.OLLAMA_URL
        self.ollama_model = settings.OLLAMA_MODEL

        if settings.OPENAI_API_KEY:
            self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.model_name = settings.OPENAI_API_MODEL or "gpt-3.5-turbo"
        elif settings.GROQ_API_KEY:
            self.client = openai.AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
            self.model_name = "llama-3.1-70b-versatile"
        else:
            self.model_name = self.ollama_model or "llama3"

    async def _call_ollama(self, prompt: str, json_mode: bool = False) -> str:
        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False
        }
        if json_mode:
            payload["format"] = "json"

        url = self.ollama_url or "http://localhost:11434"
        if not url.endswith("/api/generate") and not url.endswith("/api/chat"):
            url = f"{url.rstrip('/')}/api/generate"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "").strip()

    async def get_clinical_suggestions(self, transcript: str) -> Dict:
        """
        Analyzes a running conversation transcript and returns proactive clinical suggestions.
        Works completely free with local Ollama.
        """
        if not transcript or not transcript.strip():
            return {
                "differential_diagnoses": [],
                "suggested_questions": [],
                "red_flags": [],
                "suggested_tests": [],
                "clinical_notes": "Awaiting conversation data..."
            }

        prompt = CLINICAL_SUGGESTION_PROMPT.replace("{transcript}", transcript)

        # -- Try OpenAI / Groq --
        if self.client:
            try:
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": "You are a real-time clinical decision support AI. Output valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                return json.loads(response.choices[0].message.content)
            except Exception as e:
                logger.error(f"OpenAI/Groq clinical suggestions error: {e}")

        # -- Try Ollama (free, local) --
        if self.ollama_url:
            try:
                result_text = await self._call_ollama(prompt, json_mode=True)
                result = json.loads(result_text)
                return result
            except Exception as e:
                logger.error(f"Ollama clinical suggestions error: {e}")

        # -- Rule-based fallback (always works, no API needed) --
        return self._rule_based_suggestions(transcript)

    def _rule_based_suggestions(self, transcript: str) -> Dict:
        """
        Lightweight fallback when no LLM is available.
        """
        text_lower = transcript.lower()
        differentials = []
        questions = []
        red_flags = []
        tests = []
        notes = ""

        # Symptom → diagnosis mapping
        if any(k in text_lower for k in ["chest pain", "chest pressure", "tightness"]):
            differentials.extend(["Angina pectoris", "Acute MI", "GERD"])
            red_flags.append("Chest pain requires urgent evaluation")
            tests.extend(["12-lead ECG", "Troponin levels"])
            questions.append("Does the pain radiate to your arm or jaw?")
        if any(k in text_lower for k in ["shortness of breath", "breathless", "dyspnea"]):
            differentials.extend(["Asthma", "Pulmonary embolism", "Heart failure"])
            tests.append("SpO2 measurement, Chest X-ray")
        if any(k in text_lower for k in ["headache", "head pain", "migraine"]):
            differentials.extend(["Tension headache", "Migraine", "Hypertensive urgency"])
            questions.append("Is this the worst headache of your life?")
            red_flags.append("Sudden severe headache — consider subarachnoid hemorrhage")
        if any(k in text_lower for k in ["fever", "temperature", "chills"]):
            differentials.extend(["Viral fever", "Bacterial infection", "Sepsis"])
            tests.append("CBC, Blood cultures if high fever")
        if any(k in text_lower for k in ["cough", "sore throat", "runny nose"]):
            differentials.extend(["Upper respiratory tract infection", "Pharyngitis"])
            questions.append("How long have you had the cough?")

        # Deduplicate
        differentials = list(dict.fromkeys(differentials))[:3]
        tests = list(dict.fromkeys(tests))[:3]

        if differentials:
            notes = "Rule-based analysis: symptoms suggest possible respiratory or cardiac involvement."
        else:
            notes = "No specific clinical markers detected yet. Continue conversation."

        return {
            "differential_diagnoses": differentials,
            "suggested_questions": questions[:3],
            "red_flags": red_flags[:3],
            "suggested_tests": tests[:3],
            "clinical_notes": notes
        }

    async def general_chat(self, message: str, history: Optional[List[Dict]] = None) -> str:
        """
        General-purpose AI chat. Handles medical and non-medical queries.
        Completely free via local Ollama.
        """
        if not message.strip():
            return "Please enter a message."

        messages = [{"role": "system", "content": GENERAL_CHAT_SYSTEM_PROMPT}]
        if history:
            messages.extend(history[-10:])  # Limit context window
        messages.append({"role": "user", "content": message})

        # -- Try OpenAI / Groq --
        if self.client:
            try:
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=1024
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"OpenAI/Groq chat error: {e}")

        # -- Try Ollama (free, local) --
        if self.ollama_url:
            try:
                # Build a flat prompt for Ollama's generate API
                history_text = ""
                if history:
                    for h in history[-5:]:
                        role = h.get("role", "user")
                        content = h.get("content", "")
                        history_text += f"{role.capitalize()}: {content}\n"
                prompt = f"{GENERAL_CHAT_SYSTEM_PROMPT}\n\n{history_text}User: {message}\nAssistant:"
                return await self._call_ollama(prompt)
            except Exception as e:
                logger.error(f"Ollama chat error: {e}")

        # -- Built-in fallback --
        return (
            "I'm running without an LLM backend right now. "
            "To enable full AI chat, please install Ollama (https://ollama.ai) and run: `ollama serve`. "
            "No API keys or subscriptions needed — completely free!"
        )


clinical_assistant_service = ClinicalAssistantService()
