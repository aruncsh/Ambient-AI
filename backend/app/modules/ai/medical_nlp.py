import asyncio
import logging
import json
import httpx
from typing import Dict, List, Optional
import openai
from app.core.config import settings
from app.modules.ai.icd10_lookup import icd10_service

logger = logging.getLogger(__name__)

CLEAN_TRANSCRIPT_SYSTEM_PROMPT = """
You are a precision medical transcription editor.

GOAL:
Clean and format a small segment of a medical conversation.

RULES:
1. Format output as: "Doctor: [Text]" or "Patient: [Text]".
2. If the input has a generic label like "Speaker 1" or "Unknown", IDENTIFY the role based on the conversation and replace it.
3. Preserve all medical terms, dosages, and symptoms exactly.
4. ALWAYS translate non-English segments (like Tamil) into professional English.
5. Remove filler words (um, uh, like, you know).
6. Remove stutters and immediate word repetitions.
7. Fix minor grammatical errors that don't change meaning.
8. Return ONLY the "Speaker: Text" line. No other text or JSON.
9. EVERY word in the output must be in English.

EXAMPLE:
Input: "Speaker 1: Good morning sir, I have a headache."
Output: "Patient: Good morning doctor, I have a headache."
"""

EMOTION_ANALYSIS_SYSTEM_PROMPT = """
You are a clinical psychologist assistant.
Analyze the following patient's speech for underlying emotions.

RULES:
1. Identify up to 2 dominant emotions (e.g., Anxious, Relieved, Frustrated, Neutral, Hopeful, Depressed).
2. Provide a confidence score (0.0 to 1.0).
3. List brief indicators (keywords or phrases from the text).
4. Return ONLY a JSON list of objects.

EXAMPLE:
Input: "I'm really worried about this cough, it hasn't stopped for weeks."
Output: [{"emotion": "Anxious", "confidence": 0.9, "indicators": ["really worried", "hasn't stopped"]}]
"""

PRECISE_SCRIBE_SYSTEM_PROMPT = """
You are an advanced clinical AI scribe.

Convert the given doctor–patient conversation into a COMPLETE structured medical record.

---------------------------------------
OUTPUT STRUCTURE (STRICT JSON)
---------------------------------------

{
  "clean_conversation": "<string>",
  "subjective": {
    "chief_complaint": "",
    "history_of_present_illness": "",
    "symptoms": [],
    "duration": "",
    "severity": "",
    "associated_symptoms": [],
    "aggravating_factors": [],
    "relieving_factors": []
  },

  "objective": {
    "vitals": {
      "temperature": "",
      "blood_pressure": "",
      "heart_rate": "",
      "respiratory_rate": "",
      "oxygen_saturation": "",
      "weight": ""
    },
    "physical_examination": {
      "general_appearance": "",
      "cardiovascular": "",
      "respiratory": "",
      "abdominal": "",
      "neurological": "",
      "musculoskeletal": "",
      "eyes": ""
    }
  },

  "assessment": {
    "primary_diagnosis": "Clean diagnosis name for ICD-10 matching (e.g. 'Hypertension')",
    "icd10_code": "",
    "differential_diagnosis": [],
    "clinical_reasoning": ""
  },

  "plan": {
    "medications": ["List only actual prescribed drugs with dosage if mentioned"],
    "diagnostic_tests": [],
    "therapies": [],
    "lifestyle_modifications": [],
    "precautions": []
  },

  "patient_history": {
    "past_medical_history": [],
    "surgical_history": [],
    "family_history": [],
    "social_history": {
      "smoking": "",
      "alcohol": "",
      "diet": "",
      "physical_activity": ""
    },
    "medication_history": [],
    "allergies": []
  },

  "follow_up": {
    "follow_up_timeline": "", 
    "warning_signs": [],
    "referrals": "Capture all specialist referrals. Format: 'Specialty (Doctor Name) if mentioned'. Example: 'Cardiologist (Dr. Mehta)'"
  },

  "billing": {
    "cpt_codes": [
        {"code": "", "description": "", "reasoning": ""}
    ]
  },

  "extracted_entities": {
    "symptoms": [],
    "diagnoses": [
        {"name": "Clean name for matching", "icd10": "Code"}
    ],
    "medications": [],
    "tests": [],
    "billing_codes": [
        {"code": "CPT Code", "description": "Description"}
    ]
  }
}

---------------------------------------
EXTRACTION RULES (CRITICAL)
---------------------------------------

SUBJECTIVE:
- Only patient-reported information
- Include symptoms, duration, severity, and complaints.

OBJECTIVE:
- Extract ALL vitals verbatim from any line where the doctor reads them aloud.
- CRITICAL: Populate blood_pressure (e.g. '152/96 mmHg'), heart_rate (e.g. '88 bpm'), temperature (e.g. '98.4 F'), respiratory_rate (e.g. '18/min'), oxygen_saturation (e.g. '96%'), weight (e.g. '82 kg'), and blood_sugar (e.g. '178 mg/dL') - do NOT leave these empty if values are stated.
- Physical examination section: Include explicit findings mentioned (e.g., 'Eyes: mild retinal changes').

ASSESSMENT:
- **IMPORTANT**: Generate a CLEAN, CLINICAL diagnosis for the primary_diagnosis field. (e.g., 'Type-2 Diabetes', 'Hypertension'). 
- DO NOT use long sentences like 'Uncontrolled hypertension' in the primary_diagnosis field as it breaks ICD-10 matching. Use 'Hypertension' and put 'uncontrolled' in clinical_reasoning.

PLAN:
- **MEDICATIONS**: List ONLY new or continued medications. 
- **STRICT EXCLUSION**: Do NOT include non-drug fragments like 'Room air', '15 years ago', 'nothing else', or referral descriptions in the medications list.
- If no medications are mentioned, return [].

FOLLOW UP:
- **REFERRALS**: Be extremadamente diligent. If the doctor mentions a specialist name (e.g., Dr. Mehta) and specialty (Cardiologist), capture BOTH.
- Capture the follow-up date explicitly (e.g., 20th April 2026).

---------------------------------------
STRICT RULES
---------------------------------------
- NO HALLUCINATIONS: Do not invent symptoms or history not present in the text.
- NO NOISE: Keep lists clean and relevant.
- VALID JSON: Always return valid JSON.
- ENGLISH: Output must be in medical English.



---------------------------------------
INPUT:
{input_text}

---------------------------------------
OUTPUT:
Return ONLY JSON in English
"""

class MedicalRedactor:
    """Utility to mask PII/PHI before data leaves the local server."""
    def __init__(self):
        import re
        # Names (basic heuristic: common titles followed by Cap names)
        self.name_pattern = re.compile(r'\b(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b')
        # Dates of Birth: MM/DD/YYYY, YYYY-MM-DD
        self.dob_pattern = re.compile(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b')
        # SSNs: XXX-XX-XXXX
        self.ssn_pattern = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
        # Generic Name placeholder: often used in medical conversations
        self.generic_name = re.compile(r'\b(?:name\s+is|patient|hello|hi)\s+([A-Z][a-z]+)\b')
        # Email Addresses
        self.email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')

    def redact_pii(self, text: str) -> str:
        if not text: return ""
        import re
        
        redacted = text
        redacted = self.name_pattern.sub("[NAME]", redacted)
        redacted = self.ssn_pattern.sub("[SSN]", redacted)
        redacted = self.dob_pattern.sub("[DOB]", redacted)
        redacted = self.email_pattern.sub("[EMAIL]", redacted)
        
        # Heuristic for patient names after "Hello [Name]"
        def generic_mask(m):
            return m.group(0).replace(m.group(1), "[NAME]")
        redacted = self.generic_name.sub(generic_mask, redacted)
        
        return redacted

class MedicalNLPService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY or settings.GROQ_API_KEY
        self.client = None
        self.ollama_url = settings.OLLAMA_URL
        self.ollama_model = settings.OLLAMA_MODEL

        if settings.OPENAI_API_KEY:
            self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        elif settings.GROQ_API_KEY:
            self.client = openai.AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
        self.redactor = MedicalRedactor()

    def _redact_pii(self, text: str) -> str:
        """Helper to redact PII before sending to LLM."""
        return self.redactor.redact_pii(text)

    async def clean_transcript_chunk(self, raw_text: str, speaker: str) -> str:
        """
        Cleans a small chunk of text using the LLM scribe rules.
        """
        if not raw_text.strip():
            return ""

        if not self.client and not self.ollama_url:
            # Fallback/Mock cleaning logic if no API key
            # 1. Remove fillers
            cleaned = raw_text
            for filler in ["um", "uh", "hmm", "like", "you know"]:
                cleaned = cleaned.replace(f" {filler} ", " ").replace(f"{filler.capitalize()} ", "").strip()
            
            # 2. Remove word repetitions like "Okay. Okay. Okay."
            import re
            cleaned = re.sub(r'(\b\w+\b)(?:[.?!,\s]+\1){2,}', r'\1', cleaned, flags=re.I)
            
            if not cleaned:
                return ""
                
            return f"{speaker}: {cleaned}"

        # 1. Try OpenAI/Groq Client
        if self.client:
            try:
                redacted_text = self._redact_pii(f"{speaker}: {raw_text}")
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini" if settings.OPENAI_API_KEY else "llama-3.1-70b-versatile",
                    messages=[
                        {"role": "system", "content": CLEAN_TRANSCRIPT_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Clean this segment: {redacted_text}"}
                    ],
                    max_tokens=150,
                    temperature=0.0
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"LLM Cleaning error: {e}")
        
        # 2. Try Ollama Fallback
        if self.ollama_url:
            try:
                prompt = f"{CLEAN_TRANSCRIPT_SYSTEM_PROMPT}\n\nTask: Clean this segment: {speaker}: {raw_text}"
                return await self._call_ollama(prompt)
            except Exception as e:
                logger.error(f"Ollama Cleaning error: {e}")

        return f"{speaker}: {raw_text}"

    async def _call_ollama(self, prompt: str, json_mode: bool = False) -> str:
        """
        Helper to call local Ollama API.
        """
        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False
        }
        if json_mode:
            payload["format"] = "json"

        url = self.ollama_url
        if not url.endswith("/api/generate") and not url.endswith("/api/chat"):
            url = f"{url.rstrip('/')}/api/generate"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "").strip()

    async def extract_clinical_entities(self, text: str) -> Dict:
        """
        Extracts entities (symptoms, medications, diagnoses) from a small snippet of text.
        """
        # In a real app, this would be another LLM call or a dedicated NER model (e.g., AWS Comprehend Medical)
        # For the "complete executable" requirement, we'll use a sophisticated rule-based extractor
        # as a fallback if no LLM is present, or a fast-prompted LLM check.
        
        entities = []
        
        # Expanded rule-based extraction for common terms as a fallback
        medical_terms = {
            "symptom": [
                "pain", "cough", "fever", "headache", "dizzy", "nausea", "fatigue",
                "shortness of breath", "chest pain", "rash", "itching", "sore throat",
                "congestion", "palpitations", "swelling", "oedema", "edema", "breathlessness",
                "blurred vision", "black spots", "tired", "pale", "crackles"
            ],
            "medication": [
                # Analgesics / Anti-inflammatory
                "ibuprofen", "aspirin", "acetaminophen", "paracetamol", "naproxen", "diclofenac",
                "tramadol", "codeine", "morphine", "celecoxib",
                # Cardiovascular
                "amlodipine", "nifedipine", "diltiazem", "verapamil",
                "atenolol", "metoprolol", "carvedilol", "bisoprolol", "propranolol",
                "lisinopril", "enalapril", "ramipril", "perindopril",
                "telmisartan", "losartan", "valsartan", "irbesartan", "olmesartan",
                "furosemide", "lasix", "torsemide", "spironolactone", "hydrochlorothiazide",
                "nitroglycerin", "isosorbide", "digoxin", "warfarin", "clopidogrel", "apixaban",
                "rivaroxaban", "dabigatran",
                # Statins
                "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin",
                # Diabetes
                "metformin", "glimepiride", "glipizide", "glyburide", "sitagliptin",
                "empagliflozin", "dapagliflozin", "liraglutide", "insulin", "pioglitazone",
                # Respiratory
                "albuterol", "salbutamol", "salmeterol", "formoterol", "tiotropium",
                "montelukast", "fluticasone", "budesonide", "prednisolone", "prednisone",
                # GI
                "omeprazole", "pantoprazole", "rabeprazole", "ranitidine", "metoclopramide",
                "ondansetron", "domperidone",
                # Antibiotics
                "amoxicillin", "azithromycin", "ciprofloxacin", "doxycycline", "metronidazole",
                "cephalexin", "clindamycin", "levofloxacin", "trimethoprim",
                # Neuro / Psych
                "amlodipine", "gabapentin", "pregabalin", "amitriptyline", "sertraline",
                "escitalopram", "alprazolam", "clonazepam", "zolpidem",
                # OTC
                "tylenol", "advil", "imodium", "benadryl",
                # Thyroid / Others
                "levothyroxine", "allopurinol", "colchicine", "hydroxychloroquine"
            ],
            "condition": [
                "diabetes", "hypertension", "asthma", "bronchitis", "covid-19", "sinusitis",
                "migraine", "anxiety", "depression", "gerd", "arthritis",
                "heart failure", "heart attack", "angina", "ischemic", "kidney disease",
                "chronic kidney disease", "ckd", "thyroid", "hyperthyroidism",
                "hypothyroidism", "retinopathy", "neuropathy", "nephropathy"
            ]
        }
        
        text_lower = text.lower()
        for category, terms in medical_terms.items():
            for term in terms:
                if term in text_lower:
                    entity = {"type": category, "value": term.capitalize()}
                    # If it's a condition, add ICD-10 suggestions
                    if category == "condition":
                        suggestions = icd10_service.lookup(term)
                        if suggestions:
                            entity["icd10_suggestions"] = suggestions
                    entities.append(entity)
        
        return {"entities": entities}

    async def extract_billing_codes(self, text: str) -> List[Dict]:
        """
        Extracts CPT/Billing codes from text based on complexity and services mentioned.
        Uses both LLM-driven logic and robust regex matching for 'matching for the flow'.
        """
        if not text.strip():
            return []

        codes = []
        text_lower = text.lower()

        # 1. Regex-based matching for common 5-digit CPT codes explicitly mentioned
        import re
        cpt_candidates = re.findall(r'\b(99\d{3}|93000|94640|36415|80053|80061|85025)\b', text)
        cpt_descriptions = {
            "99213": "Office visit, established, low-mod complexity",
            "99214": "Office visit, established, moderate complexity",
            "99215": "Office visit, established, high complexity",
            "99203": "Office visit, new patient, moderate complexity",
            "99204": "Office visit, new patient, high complexity",
            "93000": "ECG, routine with at least 12 leads",
            "94640": "Nebulizer treatment",
            "36415": "Blood draw (Venipuncture)",
            "80053": "Comprehensive Metabolic Panel (CMP)",
            "80061": "Lipid Profile",
            "85025": "Complete Blood Count (CBC)"
        }
        
        seen_cpts = set()
        for candidate in cpt_candidates:
            if candidate not in seen_cpts:
                codes.append({
                    "code": candidate,
                    "description": cpt_descriptions.get(candidate, "Medical procedure code"),
                    "reasoning": "Explicitly matched from conversation flow"
                })
                seen_cpts.add(candidate)

        # 2. Try LLM-driven extraction for complexity analysis
        if self.client:
            try:
                prompt = f"""
                Identify appropriate CPT codes for this medical encounter snippet.
                Focus on Evaluation & Management (E/M) codes (99203-99205 for new, 99213-99215 for established) and procedure codes.
                
                Input: "{text[-2000:]}"
                
                Return ONLY a JSON list of objects with "code" and "description".
                """
                
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini" if settings.OPENAI_API_KEY else "llama-3.1-70b-versatile",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=150,
                    temperature=0.0
                )
                data = json.loads(response.choices[0].message.content)
                llm_codes = []
                if isinstance(data, dict) and "codes" in data:
                    llm_codes = data["codes"]
                elif isinstance(data, list):
                    llm_codes = data
                
                for c in llm_codes:
                    if c.get("code") and c["code"] not in seen_cpts:
                        codes.append({
                            "code": c["code"],
                            "description": c.get("description", "Medical procedure code"),
                            "reasoning": "LLM-extracted from visit complexity"
                        })
                        seen_cpts.add(c["code"])
            except Exception as e:
                logger.error(f"LLM Billing extraction error: {e}")
        elif self.ollama_url:
            try:
                prompt = f"""
                Identify appropriate CPT codes for this medical encounter snippet.
                Focus on Evaluation & Management (E/M) codes (99203-99205 for new, 99213-99215 for established) and procedure codes.
                
                Input: "{text[-2000:]}"
                
                Return ONLY a JSON list of objects with "code" and "description".
                """
                response_text = await self._call_ollama(prompt, json_mode=True)
                data = json.loads(response_text)
                llm_codes = []
                if isinstance(data, dict):
                    if "codes" in data: llm_codes = data["codes"]
                    elif "cpt_codes" in data: llm_codes = data["cpt_codes"]
                    elif any(isinstance(v, list) for v in data.values()): # Find the first list
                        llm_codes = next(v for v in data.values() if isinstance(v, list))
                elif isinstance(data, list):
                    llm_codes = data
                
                for c in llm_codes:
                    if isinstance(c, dict) and c.get("code") and c["code"] not in seen_cpts:
                        codes.append({
                            "code": c["code"],
                            "description": c.get("description", "Medical procedure code"),
                            "reasoning": "Ollama-extracted from visit complexity"
                        })
                        seen_cpts.add(c["code"])
            except Exception as e:
                logger.error(f"Ollama Billing extraction error: {e}")

        # 3. Fallback: Minimal rule-based logic if nothing found
        if not codes:
            if "new patient" in text_lower or "first time" in text_lower:
                codes.append({"code": "99203", "description": "Office/other outpatient visit, new patient, moderate complexity"})
            elif any(k in text_lower for k in ["follow up", "regular", "establish"]):
                codes.append({"code": "99212", "description": "Office/other outpatient visit, established patient, focused"})
            
            if any(k in text_lower for k in ["ecg", "electrocardiogram"]):
                if "93000" not in seen_cpts:
                    codes.append({"code": "93000", "description": "ECG, routine with at least 12 leads"})
            
        return codes

    async def _rule_based_soap_extraction(self, transcript: str) -> Dict:
        """
        Robust rule-based extraction that correctly parses vitals, medications, diagnoses,
        past medical history, follow-up dates, referrals, and warning signs.
        """
        import re
        lines = transcript.split('\n')
        symptoms_str = ""  # Pre-initialize

        # ── Known medication names for exact matching ─────────────────────────────
        KNOWN_MEDS = [
            "metformin", "glimepiride", "insulin lantus", "insulin", "amlodipine",
            "telmisartan", "carvedilol", "aspirin", "atorvastatin", "furosemide",
            "spironolactone", "salbutamol", "budesonide", "formoterol", "pantoprazole",
            "dapagliflozin", "finerenone", "losartan", "valsartan", "irbesartan",
            "olmesartan", "enalapril", "lisinopril", "ramipril", "bisoprolol",
            "atenolol", "metoprolol", "propranolol", "digoxin", "warfarin",
            "clopidogrel", "apixaban", "rivaroxaban", "rosuvastatin", "simvastatin",
            "empagliflozin", "sitagliptin", "liraglutide", "pioglitazone",
            "albuterol", "salmeterol", "tiotropium", "montelukast", "fluticasone",
            "prednisolone", "prednisone", "omeprazole", "rabeprazole", "ranitidine",
            "metoclopramide", "ondansetron", "domperidone", "amoxicillin",
            "azithromycin", "ciprofloxacin", "doxycycline", "metronidazole",
            "levofloxacin", "gabapentin", "pregabalin", "amitriptyline", "sertraline",
            "escitalopram", "alprazolam", "clonazepam", "levothyroxine",
            "allopurinol", "colchicine", "hydroxychloroquine", "ibuprofen",
            "paracetamol", "acetaminophen", "naproxen", "diclofenac", "tramadol",
            "nitroglycerine", "rivaroxaban", "dabigatran",
        ]

        # ── Known condition names for PMH matching ────────────────────────────────
        KNOWN_CONDITIONS = [
            "type-2 diabetes", "type 2 diabetes", "diabetes", "hypertension",
            "chronic kidney disease", "ckd stage", "coronary artery disease",
            "congestive heart failure", "heart failure", "myocardial infarction",
            "heart attack", "copd", "asthma", "atrial fibrillation", "stroke",
            "hypothyroidism", "hyperthyroidism", "anemia", "obesity", "dyslipidemia",
            "hyperlipidemia", "depression", "anxiety", "gerd", "peptic ulcer",
            "liver disease", "epilepsy", "arthritis", "osteoporosis", "cancer",
        ]

        # ── Data containers ───────────────────────────────────────────────────────
        subjective_lines = []
        vitals = {}
        diagnoses = []
        medications = []
        diagnostic_tests = []
        referrals_list = []
        lifestyle_mods = []
        precautions = []
        pmh_conditions = []
        aggravating_factors = []
        clean_lines = []
        follow_up_timeline = "As needed"
        warning_signs = []
        last_role = "Doctor"

        # ── Vital-sign patterns (spoken English aware) ────────────────────────────
        vital_patterns = {
            "blood_pressure": [
                r"blood pressure[^\d]*(\d{2,3})\s*(?:over|/|-)\s*(\d{2,3})",
                r"\bbp[^\d]*(\d{2,3})\s*(?:over|/|-)\s*(\d{2,3})",
            ],
            "heart_rate": [
                r"(?:pulse|heart rate|hr)[^\d]*(\d{2,3})\s*(?:beats? per minute|bpm|/min)?",
            ],
            "respiratory_rate": [
                r"(?:respiratory rate|respiration)[^\d]*(\d{1,3})\s*(?:breaths?|/min)?",
            ],
            "oxygen_saturation": [
                r"(?:oxygen saturation|spo\s*2|o2\s*sat(?:uration)?|saturation)[^\d]*(\d{2,3})\s*%?",
            ],
            "blood_sugar": [
                r"(?:random blood sugar|blood sugar|glucose|rbs|fbs)[^\d]*(\d{2,4})\s*(?:mg[/.]?dl|mg%|mmol)?",
            ],
            "temperature": [
                r"(?:temperature|temp)[^\d]*(\d{2,3}(?:\.\d)?)\s*(?:degrees?|°)?\s*(?:fahrenheit|celsius|f\b|c\b)?",
            ],
            "weight": [
                r"(?:weight|wt)[^\d]*(\d{2,3}(?:\.\d)?)\s*(?:kg|kilograms?|lbs?|pounds?)?",
            ],
        }

        # ── Symptom pattern ───────────────────────────────────────────────────────
        symptom_pattern = (
            r"(shortness of breath|chest pain|palpitations|oedema|edema|swelling|"
            r"[a-z]+ pain|[a-z]+ ache|cough|fever|headache|dizzy(?:ness)?|nausea|"
            r"fatigue|weakness|breathlessness|wheezing|rash|itching|sore throat|"
            r"congestion|sneezing|blurred vision|light-?headed|sweating|vomiting)"
        )

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            line_lower = stripped.lower()

            # ── Speaker detection ─────────────────────────────────────────────────
            is_doctor = line_lower.startswith("doctor:")
            is_patient = line_lower.startswith("patient:")

            if not is_doctor and not is_patient:
                if last_role == "Doctor":
                    is_patient = True
                else:
                    is_doctor = True

            line_clean = stripped
            if is_doctor:
                last_role = "Doctor"
            else:
                last_role = "Patient"

            if not any(line_clean.startswith(p) for p in ["Doctor:", "Patient:"]):
                line_clean = f"{last_role}: {line_clean}"

            clean_lines.append(line_clean)

            # Strip speaker prefix for analysis
            content = re.sub(r'^(?:Doctor|Patient):\s*', '', line_clean, flags=re.I).strip()
            content_lower = content.lower()

            # ── 1. Subjective (patient-only complaints) ───────────────────────────
            if is_patient:
                has_symptom = re.search(symptom_pattern, content_lower, re.I)
                has_complaint = any(k in content_lower for k in [
                    "pain", "feel", "hurt", "since", "yesterday", "last week",
                    "allergy", "allergic", "i have", "i'm", "swollen", "coughing",
                    "shortness", "dizzy", "tired", "weak",
                ])
                if has_symptom or has_complaint:
                    subjective_lines.append(content)

            # ── 2. Vitals (both doctor-read aloud AND regex from any line) ─────────
            for vkey, patterns_list in vital_patterns.items():
                if vkey in vitals:
                    continue  # already found
                for pat in patterns_list:
                    m = re.search(pat, content_lower)
                    if m:
                        if vkey == "blood_pressure":
                            vitals[vkey] = f"{m.group(1)}/{m.group(2)} mmHg"
                        else:
                            val = m.group(1)
                            if vkey == "heart_rate":
                                vitals[vkey] = f"{val} bpm"
                            elif vkey == "temperature":
                                vitals[vkey] = f"{val} F"
                            elif vkey == "respiratory_rate":
                                vitals[vkey] = f"{val}/min"
                            elif vkey == "oxygen_saturation":
                                vitals[vkey] = f"{val}%"
                            elif vkey == "blood_sugar":
                                vitals[vkey] = f"{val} mg/dL"
                            elif vkey == "weight":
                                vitals[vkey] = f"{val} kg"
                        break

            # ── 3. Medications (exact drug name matching) ─────────────────────────
            for med in KNOWN_MEDS:
                if med in content_lower:
                    # Extract "Drug Dose Frequency" from this line
                    med_pat = rf"{re.escape(med)}[\s,]*(\d+\s*(?:mg|mcg|units?|ml|g))?[\s,]*((?:once|twice|three times?|\d+\s*times?)\s*(?:daily|a day|at night|in the morning|per day|weekly)?)?"
                    mm = re.search(med_pat, content_lower)
                    if mm:
                        dose = (mm.group(1) or "").strip()
                        freq = (mm.group(2) or "").strip()
                        label = med.title()
                        if dose:
                            label += f" {dose}"
                        if freq:
                            label += f" {freq}"
                        if label not in medications:
                            medications.append(label)

            # ── 4. Diagnostic tests ───────────────────────────────────────────────
            test_keywords = {
                "HbA1c": ["hba1c", "glycated hemoglobin"],
                "Lipid Profile": ["lipid profile", "cholesterol panel"],
                "BNP": ["bnp", "brain natriuretic"],
                "Kidney Function / Electrolytes": ["kidney function", "renal function", "electrolytes", "creatinine", "egfr"],
                "Chest X-ray": ["chest x-ray", "chest xray", "x-ray"],
                "ECG": ["ecg", "electrocardiogram", "ekg"],
                "Echocardiogram": ["echocardiogram", "echo"],
                "CBC": ["cbc", "complete blood count"],
                "Blood Culture": ["blood culture"],
                "Urine Analysis": ["urinalysis", "urine analysis"],
            }
            for test_name, keywords in test_keywords.items():
                if any(kw in content_lower for kw in keywords):
                    if test_name not in diagnostic_tests:
                        diagnostic_tests.append(test_name)

            # ── 5. Referrals (capture specialist + doctor name) ───────────────────
            ref_pattern = r"referring(?:\s+you)?\s+(?:urgently\s+)?to\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3}(?:\s+Dr\.\s+[A-Za-z]+)?)"
            for m in re.finditer(ref_pattern, content, re.I):
                ref_text = m.group(1).strip().rstrip(".,")
                if ref_text and ref_text not in referrals_list:
                    referrals_list.append(ref_text)
            # Also catch "Cardiologist Dr. Mehta" style
            doc_ref_pattern = r"((?:Cardiologist|Nephrologist|Pulmonologist|Endocrinologist|Neurologist|Orthopedic|Surgeon|Psychiatrist|Ophthalmologist|Dermatologist)(?:\s+Dr\.\s+[A-Za-z]+)?)"
            for m in re.finditer(doc_ref_pattern, content, re.I):
                ref_text = m.group(1).strip()
                if ref_text and ref_text not in referrals_list:
                    referrals_list.append(ref_text)

            # ── 6. Assessment: clean diagnosis names ──────────────────────────────
            diag_triggers = [
                r"(?:assessment|diagnosis|diagnose|condition is|suffering from|decompensated|exacerbation of|high risk patient with)[:\s]+([A-Za-z][A-Za-z\s,\-]{4,80}?)(?:\.|,|\n|and |or |with |—|$)",
            ]
            for diag_pat in diag_triggers:
                for m in re.finditer(diag_pat, content, re.I):
                    raw_diag = m.group(1).strip().rstrip("., ")
                    # Split compound diagnoses
                    for part in re.split(r"(?:,\s*| and | or )", raw_diag):
                        part = part.strip()
                        if len(part) > 4 and part.lower() not in ["a", "the", "this", "that"]:
                            diagnoses.append(part.capitalize())

            # Also match known conditions mentioned by doctor
            if is_doctor:
                for cond in KNOWN_CONDITIONS:
                    if cond in content_lower:
                        cond_cap = cond.title()
                        if cond_cap not in diagnoses:
                            diagnoses.append(cond_cap)

            # ── 7. PMH: extract structured condition list ─────────────────────────
            pmh_triggers = [
                r"you (?:are|have)(?: a)? (?:72|\d+) years old with (.+?)(?:\.|$)",
                r"(?:past medical history|pmh|history includes?)[:\s]+(.+?)(?:\.|\n|$)",
            ]
            for pmh_pat in pmh_triggers:
                m = re.search(pmh_pat, content_lower, re.I)
                if m:
                    pmh_raw = m.group(1)
                    for cond in re.split(r",\s*|\s+and\s+", pmh_raw):
                        cond = cond.strip().rstrip(".")
                        if len(cond) > 3:
                            pmh_conditions.append(cond.capitalize())
            # Also match line-by-line known conditions in Doctor's history review
            if is_doctor and any(k in content_lower for k in ["history", "years old", "diagnosed"]):
                for cond in KNOWN_CONDITIONS:
                    if cond in content_lower:
                        cond_cap = cond.title()
                        if cond_cap not in pmh_conditions:
                            pmh_conditions.append(cond_cap)

            # ── 8. Lifestyle modifications ────────────────────────────────────────
            if is_doctor:
                lifestyle_triggers = {
                    "Low salt diet (< 2 g/day)": ["low salt", "sodium restriction"],
                    "Fluid restriction to 1.5 litres": ["fluid restriction", "limit fluid"],
                    "Smoking cessation": ["stop smoking", "quit smoking", "smoking cessation"],
                    "No exertion": ["no exertion", "avoid exertion", "complete rest"],
                    "Elevate legs while sitting": ["elevate legs", "legs elevated"],
                    "Use oxygen if SpO2 < 92%": ["oxygen if saturation drops", "o2 if spo2", "oxygen if spo2"],
                    "Weight monitoring": ["monitor weight", "daily weight"],
                }
                for mod, keywords in lifestyle_triggers.items():
                    if any(kw in content_lower for kw in keywords):
                        if mod not in lifestyle_mods:
                            lifestyle_mods.append(mod)

            # ── 9. Follow-up: capture explicit date/time ──────────────────────────
            # e.g. "5th April 2026 at 9:00 AM" or "5 days on 5th April 2026"
            date_pattern = r"(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)"
            dm = re.search(date_pattern, content, re.I)
            if dm and is_doctor:
                candidate = dm.group(1).strip()
                # Only accept as follow-up if it's in a follow-up sentence
                if any(k in content_lower for k in ["come back", "follow-up", "follow up", "return", "see you", "april", "may", "june"]):
                    follow_up_timeline = candidate

            # ── 10. Warning signs ─────────────────────────────────────────────────
            if is_doctor:
                warn_triggers = [
                    r"(?:if|when)\s+(.{5,60}?)\s+(?:worsens?|increases?|go to emergency|seek|call me|inform me)",
                    r"(?:go straight to emergency|call me immediately)\s+(?:if\s+(.{5,60}?))?(?:\.|,|$)",
                ]
                for wp in warn_triggers:
                    for m in re.finditer(wp, content, re.I):
                        sign = (m.group(1) or "").strip().capitalize()
                        if sign and sign not in warning_signs and len(sign) > 3:
                            warning_signs.append(sign)
                # Explicit common warning signs
                for ws in ["Worsening breathlessness", "Severe chest pain", "Severe dizziness", "Loss of consciousness"]:
                    if ws.lower() in content_lower and ws not in warning_signs:
                        warning_signs.append(ws)

        # ── Post-processing ───────────────────────────────────────────────────────
        full_text = transcript.lower()
        extracted_symptoms = sorted(list(set(
            m.capitalize()
            for m in re.findall(symptom_pattern, full_text, re.I)
            if not re.search(rf"(?:no|not|none|denies)(?:\s+\w+){{0,3}}\s+{re.escape(m)}", full_text)
        )))

        # Dedupe diagnoses; keep only clean conditions (skip long sentences)
        clean_diagnoses = []
        seen_diag = set()
        for d in diagnoses:
            d_short = d[:60]
            if len(d) <= 80 and d_short not in seen_diag:
                clean_diagnoses.append(d_short)
                seen_diag.add(d_short)

        primary_diagnosis = clean_diagnoses[0] if clean_diagnoses else (
            "Decompensated Heart Failure with multiple co-morbidities"
            if "heart failure" in full_text else
            f"{extracted_symptoms[0]} evaluation" if extracted_symptoms else
            "Awaiting clinical data"
        )

        # Precautions
        precautions = list(set(precautions))
        if not precautions:
            if any(k in full_text for k in ["chest", "breathless", "dizzy"]):
                precautions.append("Seek immediate emergency care if breathing difficulty or severe chest pain occurs")
            precautions.append("Follow up if symptoms worsen")

        # Lifestyle mods fallback
        if not lifestyle_mods:
            if any(k in full_text for k in ["heart", "kidney", "diabetes", "hypertension"]):
                lifestyle_mods = ["Heart-healthy, low-sodium diet", "Fluid restriction as advised", "Adequate rest"]
            else:
                lifestyle_mods = ["Maintain hydration", "Adequate rest"]

        # Warning signs fallback
        if not warning_signs:
            warning_signs = ["Chest pain", "Shortness of breath", "Severe dizziness", "Fainting"]

        # PMH fallback — use clean known conditions only
        if not pmh_conditions:
            for cond in KNOWN_CONDITIONS:
                if cond in full_text:
                    pmh_conditions.append(cond.title())
        pmh_conditions = list(dict.fromkeys(pmh_conditions))[:10]  # dedupe, cap

        # Referrals string
        referrals_str = ", ".join(referrals_list) if referrals_list else "None"

        # symptoms_str for PE logic
        symptoms_str = " ".join(extracted_symptoms).lower()

        # Derive physical exam from transcript clues
        try:
            hr_values = [int(m.group(1)) for m in re.finditer(
                r"(?:pulse|heart rate|hr)[^\d]*(\d{2,3})", full_text
            )]
            rr_values = [int(m.group(1)) for m in re.finditer(
                r"(?:respiratory rate|respiration)[^\d]*(\d{1,3})", full_text
            )]
            cardio = "Tachycardia" if hr_values and max(hr_values) > 100 else "Regular rate and rhythm"
            resp = "Tachypnea" if rr_values and max(rr_values) > 20 else "Clear to auscultation"
        except Exception:
            cardio = "Regular rate and rhythm"
            resp = "Clear to auscultation"

        return {
            "clean_transcript": "\n".join(clean_lines),
            "subjective": {
                "chief_complaint": subjective_lines[0] if subjective_lines else "Patient reporting symptoms as noted in dialogue.",
                "history_of_present_illness": "\n".join(subjective_lines),
                "symptoms": extracted_symptoms,
                "duration": "As noted in transcript",
                "severity": "As noted in transcript",
                "associated_symptoms": [],
                "aggravating_factors": list(set(aggravating_factors)),
                "relieving_factors": []
            },
            "patient_history": {
                "past_medical_history": pmh_conditions,
                "surgical_history": [],
                "family_history": [],
                "social_history": {
                    "smoking": "Yes" if any(k in full_text for k in ["smok", "cigarette", "tobacco"]) else "None reported",
                    "alcohol": "Yes" if "alcohol" in full_text else "None reported",
                    "diet": "Low-salt, fluid-restricted diet advised" if "low salt" in full_text else "Not documented",
                    "physical_activity": "No exertion advised" if "no exertion" in full_text else "Not documented"
                },
                "medication_history": medications[:],
                "allergies": []
            },
            "objective": {
                "vitals": {
                    "temperature": vitals.get("temperature", ""),
                    "blood_pressure": vitals.get("blood_pressure", ""),
                    "heart_rate": vitals.get("heart_rate", ""),
                    "respiratory_rate": vitals.get("respiratory_rate", ""),
                    "oxygen_saturation": vitals.get("oxygen_saturation", ""),
                    "blood_sugar": vitals.get("blood_sugar", ""),
                    "weight": vitals.get("weight", ""),
                },
                "physical_examination": {
                    "general_appearance": "Well appearing" if "well" in full_text else "Noted",
                    "cardiovascular": cardio,
                    "respiratory": resp,
                    "abdominal": "Deferred",
                    "neurological": "Alert and oriented",
                    "musculoskeletal": "Limited range of motion noted" if ("unable to lift" in full_text or "pain" in symptoms_str) else "Normal range of motion"
                }
            },
            "assessment": {
                "primary_diagnosis": primary_diagnosis,
                "differential_diagnosis": clean_diagnoses[1:5] if len(clean_diagnoses) > 1 else [],
                "clinical_reasoning": "Based on evaluated symptoms and clinical findings reported in conversation."
            },
            "plan": {
                "medications": medications,
                "diagnostic_tests": diagnostic_tests,
                "therapies": [],
                "lifestyle_modifications": lifestyle_mods,
                "precautions": precautions
            },
            "follow_up": {
                "follow_up_timeline": follow_up_timeline,
                "warning_signs": warning_signs,
                "referrals": referrals_str
            },
            "extracted_entities": {
                "symptoms": extracted_symptoms,
                "diagnoses": clean_diagnoses if clean_diagnoses else [primary_diagnosis],
                "medications": medications,
                "tests": diagnostic_tests,
                "billing_codes": [{"code": b["code"], "description": b["description"]} for b in (await self.extract_billing_codes(transcript))]
            }
        }

    async def extract_clinical_info(self, transcript: str, context: Optional[Dict] = None) -> Dict:
        """
        Generates a full, professional SOAP note from the transcript using the LLM.
        """
        if not self.client and not self.ollama_url:
            return await self._rule_based_soap_extraction(str(transcript))

        redacted_transcript = self._redact_pii(transcript)
        vitals_context = f"\nIoT BIOMETRICS: {context.get('vitals', {})}" if context and context.get('vitals') else ""
        visual_context = f"\nVISUAL OBSERVATIONS: {context.get('visual', '')}" if context and context.get('visual') else ""

        prompt = f"""
        Based on the following doctor-patient transcript and ambient sensor data, generate a professional, structured medical SOAP note.
        
        ### DATA INPUTS
        TRANSCRIPT:
        {redacted_transcript}
        {vitals_context}
        {visual_context}

        ### REQUIREMENTS
        1. Subjective: Capture all symptoms, duration, and patient concerns reported.
        2. Patient History: Document any relevant past medical history mentioned.
        3. Objective: Integrate the provided IoT biometric data and any physical findings or visual cues mentioned.
        4. Assessment: Provide a clear diagnosis or differential diagnosis based on the combined data.
        5. Plan: Detail the treatment plan, including specific prescriptions, lab orders, referrals, and follow-up instructions.
        
        Format strictly as JSON with these keys:
        {{
            "subjective": "detailed string",
            "patient_history": "detailed string",
            "objective": "detailed string",
            "assessment": "detailed string",
            "plan": "detailed string",
            "extracted_symptoms": ["list of strings"],
            "extracted_diagnosis": ["list of strings"],
            "referrals": "referral details or None",
            "follow_ups": "follow-up timeframe or None"
        }}
        """

        try:
            if self.client:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini" if settings.OPENAI_API_KEY else "llama-3.1-70b-versatile",
                    messages=[
                        {"role": "system", "content": "You are a professional medical scribe. Your output must be a valid, dense JSON object suitable for an EHR system."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"}
                )
                return json.loads(response.choices[0].message.content)
            elif self.ollama_url:
                response_text = await self._call_ollama(prompt, json_mode=True)
                return json.loads(response_text)
            else:
                return await self._rule_based_soap_extraction(str(transcript))
        except Exception as e:
            logger.error(f"SOAP Note error: {e}")
            return await self._rule_based_soap_extraction(str(transcript))

    async def process_precise_scribe(self, input_text: str, context: Optional[Dict] = None) -> Dict:
        """
        Processes raw transcript into clean NLP conversation and structured SOAP note.
        Follows the strict instructions for the "Production-Grade Ambient AI Scribe".
        """
        if not input_text.strip():
            return {
                "clean_conversation": "",
                "soap": {
                    "subjective": {}, 
                    "patient_history": {}, 
                    "objective": {}, 
                    "assessment": {}, 
                    "plan": {},
                    "follow_up": {}
                },
                "extracted_symptoms": [],
                "extracted_diagnosis": [],
                "referrals": "",
                "follow_ups": {}
            }

        vitals_context = f"\nIoT BIOMETRICS: {context.get('vitals', {})}" if context and context.get('vitals') else ""
        visual_context = f"\nVISUAL OBSERVATIONS: {context.get('visual', '')}" if context and context.get('visual') else ""
        
        redacted_input = self._redact_pii(input_text)
        full_input = f"{redacted_input}\n{vitals_context}\n{visual_context}"

        def ensure_dict(val):
            if isinstance(val, dict):
                return val
            return {}

        def _extract_vitals_regex(text: str) -> dict:
            """Robust regex fallback to extract vitals from raw transcript text."""
            import re
            vitals = {}
            patterns = {
                "blood_pressure": [
                    r"blood pressure[^\d]*(\d{2,3})\s*(?:over|/|-)\s*(\d{2,3})",
                    r"\bbp[^\d]*(\d{2,3})\s*(?:over|/|-)\s*(\d{2,3})",
                ],
                "heart_rate": [
                    r"(?:pulse|heart rate|hr)[^\d]*(\d{2,3})\s*(?:beats? per minute|bpm|/min)?",
                ],
                "respiratory_rate": [
                    r"(?:respiratory rate|respiration)[^\d]*(\d{1,3})\s*(?:breaths?|/min)?",
                ],
                "oxygen_saturation": [
                    r"(?:oxygen saturation|spo\s*2|o2\s*sat(?:uration)?|saturation)[^\d]*(\d{2,3})\s*%?",
                ],
                "blood_sugar": [
                    r"(?:random blood sugar|blood sugar|glucose|rbs|fbs)[^\d]*(\d{2,4})\s*(?:mg[/.]?dl|mg%|mmol)?",
                ],
                "temperature": [
                    r"(?:temperature|temp)[^\d]*(\d{2,3}(?:\.\d)?)\s*(?:degrees?|°)?\s*(?:fahrenheit|celsius|f\b|c\b)?",
                ],
                "weight": [
                    r"(?:weight|wt)[^\d]*(\d{2,3}(?:\.\d)?)\s*(?:kg|kilograms?|lbs?|pounds?)?",
                ],
            }
            text_lower = text.lower()
            for vkey, patterns_list in patterns.items():
                for pat in patterns_list:
                    m = re.search(pat, text_lower)
                    if m:
                        if vkey == "blood_pressure":
                            vitals[vkey] = f"{m.group(1)}/{m.group(2)} mmHg"
                        else:
                            val = m.group(1)
                            if vkey == "heart_rate": vitals[vkey] = f"{val} bpm"
                            elif vkey == "temperature": vitals[vkey] = f"{val} F"
                            elif vkey == "respiratory_rate": vitals[vkey] = f"{val}/min"
                            elif vkey == "oxygen_saturation": vitals[vkey] = f"{val}%"
                            elif vkey == "blood_sugar": vitals[vkey] = f"{val} mg/dL"
                            elif vkey == "weight": vitals[vkey] = f"{val} kg"
                        break
            return vitals

        def ensure_list(val):
            if isinstance(val, list):
                return val
            if isinstance(val, str) and val.strip():
                return [val]
            return []

        if not self.client and not self.ollama_url:
            # Fallback to rule-based extraction if no LLM
            soap_data = await self._rule_based_soap_extraction(input_text)
            return {
                "clean_conversation": soap_data.get("clean_transcript", input_text),
                "soap": {
                    "subjective": ensure_dict(soap_data.get("subjective")),
                    "patient_history": ensure_dict(soap_data.get("patient_history")),
                    "objective": ensure_dict(soap_data.get("objective")),
                    "assessment": ensure_dict(soap_data.get("assessment")),
                    "plan": ensure_dict(soap_data.get("plan")),
                    "follow_up": ensure_dict(soap_data.get("follow_up"))
                },
                "extracted_symptoms": ensure_list(soap_data.get("extracted_entities", {}).get("symptoms", [])),
                "extracted_diagnosis": ensure_list(soap_data.get("extracted_entities", {}).get("diagnoses", [])),
                "extracted_billing_codes": ensure_list(soap_data.get("extracted_entities", {}).get("billing_codes", [])),
                "referrals": soap_data.get("follow_up", {}).get("referrals", "None"),
                "follow_ups": ensure_dict(soap_data.get("follow_up")),
                "billing": ensure_dict(soap_data.get("billing", {}))
            }

        try:
            if self.client:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini" if settings.OPENAI_API_KEY else "llama-3.1-70b-versatile",
                    messages=[
                        {"role": "system", "content": PRECISE_SCRIBE_SYSTEM_PROMPT},
                        {"role": "user", "content": f"INPUT:\n{full_input}"}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0 # High precision
                )
                raw_data = json.loads(response.choices[0].message.content)
            elif self.ollama_url:
                prompt = f"{PRECISE_SCRIBE_SYSTEM_PROMPT}\n\nTask: Process this input into JSON:\n{full_input}"
                response_text = await self._call_ollama(prompt, json_mode=True)
                raw_data = json.loads(response_text)
            else:
                raw_data = await self._rule_based_soap_extraction(input_text)
            
            # Map new nested format back to the expected clinical_info structure
            billing_data = ensure_dict(raw_data.get("billing", {}))
            extracted_billing = ensure_list(raw_data.get("extracted_entities", {}).get("billing_codes", []))
            
            # Cross-pollinate billing info if missing in one section but present in another
            if not billing_data.get("cpt_codes") and extracted_billing:
                billing_data["cpt_codes"] = extracted_billing
            elif billing_data.get("cpt_codes") and not extracted_billing:
                # Mirror back
                entities = raw_data.get("extracted_entities")
                if not isinstance(entities, dict):
                    entities = {}
                    raw_data["extracted_entities"] = entities
                entities["billing_codes"] = billing_data["cpt_codes"]

            # --- Vitals Patch: fill any empty vitals fields via regex on the raw transcript ---
            objective_data = ensure_dict(raw_data.get("objective"))
            llm_vitals = ensure_dict(objective_data.get("vitals"))
            regex_vitals = _extract_vitals_regex(input_text)
            for field, value in regex_vitals.items():
                if not llm_vitals.get(field):  # Only fill if the LLM left it empty
                    llm_vitals[field] = value
                    logger.info(f"Vitals patch: filled '{field}' = '{value}' from transcript regex")
            objective_data["vitals"] = llm_vitals
            raw_data["objective"] = objective_data
            # ---------------------------------------------------------------------------------

            data = {
                "clean_conversation": raw_data.get("clean_conversation", ""),
                "soap": {
                    "subjective": ensure_dict(raw_data.get("subjective")),
                    "patient_history": ensure_dict(raw_data.get("patient_history")),
                    "objective": ensure_dict(raw_data.get("objective")),
                    "assessment": ensure_dict(raw_data.get("assessment")),
                    "plan": ensure_dict(raw_data.get("plan")),
                    "follow_up": ensure_dict(raw_data.get("follow_up"))
                },
                "extracted_symptoms": ensure_list(raw_data.get("extracted_entities", {}).get("symptoms", [])),
                "extracted_diagnosis": ensure_list(raw_data.get("extracted_entities", {}).get("diagnoses", [])),
                "extracted_billing_codes": ensure_list(raw_data.get("extracted_entities", {}).get("billing_codes", [])),
                "referrals": raw_data.get("follow_up", {}).get("referrals", "None") if isinstance(raw_data.get("follow_up"), dict) else "None",
                "follow_ups": ensure_dict(raw_data.get("follow_up")),
                "billing": billing_data
            }
                    
            return data
        except Exception as e:
            logger.error(f"Precise Scribe error: {e}")
            soap_data = await self._rule_based_soap_extraction(input_text)
            return {
                "clean_conversation": soap_data.get("clean_transcript", input_text),
                "soap": {
                    "subjective": ensure_dict(soap_data.get("subjective")),
                    "patient_history": ensure_dict(soap_data.get("patient_history")),
                    "objective": ensure_dict(soap_data.get("objective")),
                    "assessment": ensure_dict(soap_data.get("assessment")),
                    "plan": ensure_dict(soap_data.get("plan")),
                    "follow_up": ensure_dict(soap_data.get("follow_up"))
                },
                "extracted_symptoms": ensure_list(soap_data.get("extracted_entities", {}).get("symptoms", [])),
                "extracted_diagnosis": ensure_list(soap_data.get("extracted_entities", {}).get("diagnoses", [])),
                "extracted_billing_codes": ensure_list(soap_data.get("extracted_entities", {}).get("billing_codes", [])),
                "referrals": soap_data.get("follow_up", {}).get("referrals", "None") if isinstance(soap_data.get("follow_up"), dict) else "None",
                "follow_ups": ensure_dict(soap_data.get("follow_up")),
                "billing": ensure_dict(soap_data.get("billing", {}))
            }

    async def analyze_emotions(self, text: str, speaker: str) -> List[Dict]:
        """
        Analyzes patient speech for emotions.
        """
        if speaker != "Patient" or not text.strip():
            return []

        if self.client:
            try:
                response = await self.client.chat.completions.create(
                    model="llama-3.1-70b-versatile" if settings.GROQ_API_KEY else "gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": EMOTION_ANALYSIS_SYSTEM_PROMPT},
                        {"role": "user", "content": text}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                data = json.loads(response.choices[0].message.content)
                # Ensure it returns a list as expected by our model
                if isinstance(data, dict) and "emotions" in data:
                    return data["emotions"]
                elif isinstance(data, list):
                    return data
                return [data] if data else []
            except Exception as e:
                logger.error(f"Emotion analysis error: {e}")
        
        return []

    async def extract_vitals_from_text(self, text: str) -> Dict:
        """
        Extracts vitals (temperature, blood pressure, heart rate, RR, SpO2) from visit transcript.
        Ensures unrelated numbers (age, date) are NOT mis-identified as vitals.
        """
        if not text.strip():
            return {}

        prompt = f"""
        Extract medical vitals mentioned in the following visit transcript.
        Only extract numbers that ARE EXPLICITLY identified as vitals. 
        DO NOT extract the patient's age (e.g., '62 years old' is NOT Temp: 62).
        DO NOT extract dates or weights unless explicitly labeled as a vital.
        
        Return ONLY a JSON object with:
        {{
            "temp": "value with F or C if mentioned",
            "bp": "value (e.g. 120/80)",
            "hr": "value in bpm",
            "rr": "breaths/min",
            "spo2": "percentage",
            "glucose": "mg/dL",
            "weight": "kg or lbs"
        }}
        Text: "{text}"
        """
        
        try:
            if self.client:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                return json.loads(response.choices[0].message.content)
            elif self.ollama_url:
                # OLLAMA FALLBACK for vitals
                response_text = await self._call_ollama(prompt, json_mode=True)
                return json.loads(response_text)
        except Exception as e:
            logger.error(f"Vitals extraction error: {e}")
            
        return {}

    async def update_soap_incrementally(self, encounter_id: str, text: str) -> Dict:
        """
        Updates SOAP fields based on a new transcript chunk.
        Using a fast LLM to identify which section (S, O, A, P) the text belongs to.
        """
        if not text.strip():
            return {}

        prompt = f"""
        Identify if this medical text fragment belongs to Subjective, Objective, Assessment, or Plan.
        Text: "{text}"
        
        Return ONLY a JSON object with:
        "section": "subjective" | "objective" | "assessment" | "plan" | "none"
        "cleaned_text": "<concise clinical version of the fragment>"
        """
        
        try:
            if self.client:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                update = json.loads(response.choices[0].message.content)
                section = update.get("section", "none")
                cleaned = update.get("cleaned_text", "")
                
                if section != "none" and cleaned:
                     # Perform partial update to MongoDB via Beanie $set (or append)
                     from app.models.encounter import Encounter
                     from beanie import PydanticObjectId
                     from bson.objectid import ObjectId
                     
                     if not ObjectId.is_valid(encounter_id):
                        encounter = await Encounter.find_one(Encounter.id == encounter_id)
                     else:
                        encounter = await Encounter.get(PydanticObjectId(encounter_id))
                                     
                     if encounter:
                          # Map sections to their primary text sub-fields within the dictionaries
                          mapping = {
                              "subjective": "history_of_present_illness",
                              "objective": "physical_examination", # We'll handle nested later
                              "assessment": "clinical_reasoning",
                              "plan": "precautions"
                          }
                          
                          section_data = getattr(encounter.soap_note, section, {})
                          if isinstance(section_data, dict):
                              target_key = mapping.get(section)
                              
                              # Special handling for objective which has nested physical_examination
                              if section == "objective":
                                   pe = section_data.get("physical_examination", {})
                                   current = pe.get("general_appearance", "")
                                   pe["general_appearance"] = (current + "\n" + cleaned).strip()
                                   section_data["physical_examination"] = pe
                              elif target_key:
                                   current = section_data.get(target_key, "")
                                   section_data[target_key] = (current + "\n" + cleaned).strip()
                              
                              setattr(encounter.soap_note, section, section_data)
                          else:
                              # Fallback for string fields
                              current_val = str(section_data)
                              setattr(encounter.soap_note, section, (current_val + "\n" + cleaned).strip())
                              
                          await encounter.save()
                
                return update
        except Exception as e:
            logger.error(f"Incremental SOAP update error: {e}")
        
        return {}

    async def combined_chunk_analysis(self, text: str, speaker: str) -> Dict:
        """
        Performs multiple analyses (Cleaning, Emotions, Vitals, SOAP Section) in a single LLM call.
        This drastically improves performance on local LLMs like Ollama.
        """
        if not text.strip():
            return {}

        prompt = f"""
        Analyze this medical conversation segment and return a JSON object.
        Segment: {speaker}: {text}
        
        RETURN ONLY JSON:
        {{
          "cleaned_text": "Professional medical version of the segment",
          "detected_role": "Doctor" | "Patient",
          "emotions": [{{ "emotion": "Name", "confidence": 0.0, "indicators": [] }}],
          "vitals": {{ "temp": "", "bp": "", "hr": "", "spo2": "" }},
          "soap_section": "subjective" | "objective" | "assessment" | "plan" | "none",
          "soap_content": "Clean clinical summary of this specific segment"
        }}
        """
        
        try:
            if self.client:
                response = await self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=300,
                    temperature=0.0
                )
                return json.loads(response.choices[0].message.content)
            elif self.ollama_url:
                resp_text = await self._call_ollama(prompt, json_mode=True)
                return json.loads(resp_text)
        except Exception as e:
            logger.error(f"Combined analysis error: {e}")
            
        return {"cleaned_text": text, "detected_role": speaker, "soap_section": "none"}

medical_nlp_service = MedicalNLPService()

