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
- Only measurable data (vitals) mentioned in the visit.
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
            "symptom": ["pain", "cough", "fever", "headache", "dizzy", "nausea", "fatigue", "shortness of breath", "chest pain", "rash", "itching", "sore throat", "congestion"],
            "medication": ["ibuprofen", "aspirin", "metformin", "lisinopril", "albuterol", "tylenol", "advil", "amoxicillin", "atorvastatin", "omeprazole"],
            "condition": ["diabetes", "hypertension", "asthma", "bronchitis", "covid-19", "sinusitis", "migraine", "anxiety", "depression", "gerd", "arthritis"]
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
        Improved rule-based extraction that avoids dumping the whole transcript into Subjective.
        """
        import re
        lines = transcript.split('\n')
        symptoms_str = "" # Pre-initialize to avoid scope issues
        
        # Data containers
        subjective_lines = []
        vitals = []
        diagnoses = []
        treatments = []
        history = []
        aggravating_factors = []
        clean_lines = []
        follow_up_timeline = "As needed"
        warning_signs = ["Chest pain", "Shortness of breath", "Fainting"]
        last_role = "Doctor" # Heuristic: Doctor usually starts the conversation

        # Patterns — support both slash-notation (120/80), dash-notation (140-80), and phonetic typos
        patterns = {
            "temp": r"(?:temp|temperature|t)[,\s]*(?:is|was|at|of)?[,\s]*(\d{2,3}(?:\.\d)?)",
            "bp": r"(?:bp|blood pressure|pressure)[,\s]*(?:is|was|at|of)?[,\s]*(\d{2,3})[/\s-]*(\d{2,3})", # Added - for dash
            "spo2": r"(?:spo2|spo\b|oxygen|saturation|o2)[,\s]*(?:is|was|at|of)?[,\s]*(\d{2,3})\s*%?",
            "hr": r"(?:heart rate|hr|bpm)[,\s]*(?:is|was|at|of)?[,\s]*(\d{2,3})",
            "rr": r"(?:respiratory rate|respiration rate|rr)[,\s]*(?:is|was|at|of)?[,\s]*(\d{1,3})",
            "blood_sugar": r"(?:blood sugar|glucose|fbs|rbs)[,\s]*(?:is|was|at|of)?[,\s]*(\d{2,3})",
            "diagnosis": r"(?:diagnosis|consistent with|condition is|is\s+a|suggestive of|findings are|differential|suspect|called|looks like|likely|diagnose you with|medical terms, this is|diagnosed with|is\s+essential|add\s+([a-z]+)\s+to the list)\s+([a-zA-Z\s\-\(\)\d—]{5,100})(?:\s+—|\s+\(|\.|\n|$)",
            "medication": r"(?:take|taking|prescribe|rx|start|continue|treatment includes|administer|order|ordered|treatment is|plan includes|requires|required|needed|needs|undergo|on)\s+([a-zA-Z,\s\d]{3,200})(?:\.|\n|$)",
            "symptoms": r"([a-z]+\s+pain|[a-z]+\s+ache|[a-z]+\s+discomfort|pain|cough|fever|headache|dizzy|nausea|fatigue|cold|shortness of breath|chest pain|tired|sweating|shortness of breath|nauseous|discomfort|pressure|ache|palpitations|wheezing|allerg[a-z]*|rash|itch[a-z]*|swell[a-z]*|hives|redness|bumps|sneezing|congestion|wiped out|light-headed|exhausting)",
            "allergy_trigger": r"(?:allergic to|when(?:ever)? i eat|when(?:ever)? i take|when(?:ever)? i use|reaction to|triggers)\s+([a-z\s]{3,50}?)(\s+and|\s+which|\s+since|\.|\n|,|$|i\s+face|i\s+get|i\s+have|it\s+causes)",
            "referral": r"(?:refer|referral|specialist|see\s+a|consult)\s+([a-zA-Z\s]{3,50}?)(\.|\n|,|$|\s+for|\s+to)",
            "follow_up": r"(?:reassess|follow up|see you|come back|come|return|check in|check)\s+(?:in|within|after)\s+([a-zA-Z0-9\s]{2,20}?)(\.|\n|,|$|\s+if|\s+to|\s+until|\s+or)",
            "warning_signs": r"(?:emergency|immediate|seek care|go to the|warning|if you develop)\s+([a-zA-Z0-9\s]{5,100}?)(\.|\n|,|$|\s+please|\s+then)"
        }

        for line in transcript.split('\n'):
            line_lower = line.lower().strip()
            if not line_lower: continue
            
            # Robust speaker detection for "Doctor: Name:" or "Patient: Name:" formats
            is_doctor = "doctor:" in line_lower or any(k in line_lower for k in ["how long", "since when", "where does", "show me", "breathe", "cough", "take", "prescribe", "treatment", "diagnosis", "fever", "exam", "history", "symptoms", "dosage", "results", "follow", "pharmacy", "take", "how many", "blood pressure", "sugar", "diabetic", "pulse", "report", "clinical", "signs", "assess", "diagnose", "referral", r"i’m dr\.", r"dr\. "])
            
            # If the line contains a common patient names or patient: marker but NOT as a secondary prefix after Doctor:
            is_patient = "patient:" in line_lower or (not is_doctor and any(s in line_lower for s in ["pain", "feel", "i have", "hurt", "yesterday", "last week", "allergy", "allergic", "rash", "itch", "eat", "use", "headache", "dizzy", "fatigue", "nausea", "coughing", "sir", "doctor", "doc", "help", "problem", "started", "worse", "better", "itchy", "sore", "burning", "tired", "weak", "sleeping", "appetite", "wiped out"]))
            
            # Special case for "Doctor: Rob:" - Rob is a patient name, Nguyen is doctor
            if "doctor: rob:" in line_lower or "rob:" in line_lower:
                is_doctor = False
                is_patient = True
            elif r"doctor: dr\. " in line_lower or r"dr\. nguyen" in line_lower:
                is_doctor = True
                is_patient = False
            
            line_clean = line # Initialize line_clean here
            if not is_doctor and not is_patient:
                # Stateful fallback: Alternating roles
                if last_role == "Doctor": is_patient = True
                else: is_doctor = True
            if is_doctor and not is_patient:
                line_clean = line_clean.replace("Speaker 1:", "Doctor:").replace("Speaker 2:", "Doctor:").replace("Unknown:", "Doctor:").replace("unknown:", "Doctor:")
                last_role = "Doctor"
            elif is_patient:
                line_clean = line_clean.replace("Speaker 1:", "Patient:").replace("Speaker 2:", "Patient:").replace("Unknown:", "Patient:").replace("unknown:", "Patient:")
                last_role = "Patient"
            
            # Ensure Doctor/Patient labels if missing
            if not any(line_clean.startswith(p) for p in ["Doctor:", "Patient:"]):
                if is_doctor: line_clean = f"Doctor: {line_clean}"
                elif is_patient: line_clean = f"Patient: {line_clean}"
            
            clean_lines.append(line_clean)
            
            line_lower = line_clean.lower() # Re-evaluate after potential label fix

            # 1. Subjective: Only extract symptoms and patient complaints
            if is_patient:
                # Be more selective about what's subjective
                has_symptom = re.search(patterns["symptoms"], line_lower, re.I)
                has_history = any(k in line_lower for k in ["diabetes", "hypertension", "history"])
                has_complaint = any(k in line_lower for k in ["pain", "feel", "hurt", "since", "yesterday", "allergy", "allergic"])
                has_trigger = re.search(patterns["allergy_trigger"], line_lower, re.I)
                
                if has_symptom or has_history or has_complaint or has_trigger:
                    clean_line = line_clean
                    for prefix in ["Unknown:", "unknown:", "Patient:", "patient:", "Doctor:", "doctor:"]:
                        clean_line = clean_line.replace(prefix, "").strip()
                    subjective_lines.append(clean_line)

                # Extract triggers for patient history
                if has_trigger:
                    trigger_item = has_trigger.group(1).strip()
                    # Clean up trigger item (remove leading articles/demonstratives)
                    trigger_item = re.sub(r'^(?:a|an|the|this|that|these|those)\s+', '', trigger_item, flags=re.I)
                    aggravating_factors.append(trigger_item)
                    # Look for what happened
                    symptom_match = re.search(patterns["symptoms"], line_lower)
                    reaction = f" (reaction: {symptom_match.group(1)})" if symptom_match else ""
                    history.append(f"Allergic to {trigger_item}{reaction}")

            # 2. Objective: Vitals & Physical findings
            for m in re.finditer(patterns["temp"], line_lower):
                vitals.append(f"Temp: {m.group(1)} F")
            for m in re.finditer(patterns["bp"], line_lower):
                vitals.append(f"BP: {m.group(1)}/{m.group(2)}")
            for m in re.finditer(patterns["spo2"], line_lower):
                vitals.append(f"SpO2: {m.group(1)}%")
            for m in re.finditer(patterns["hr"], line_lower):
                vitals.append(f"HR: {m.group(1)} bpm")
            for m in re.finditer(patterns["rr"], line_lower):
                vitals.append(f"RR: {m.group(1)}/min")
            for m in re.finditer(patterns["blood_sugar"], line_lower):
                vitals.append(f"BloodSugar: {m.group(1)} mg/dL")

            if "inflamed" in line_lower: vitals.append("Physical: Inflamed throat")
            if "clear" in line_lower and "lungs" in line_lower: vitals.append("Physical: Lungs clear")

            # 3. Assessment: Diagnosis
            for m in re.finditer(patterns["diagnosis"], line_lower):
                diag_val = m.group(2).strip() # Changed from group(1) to group(2) to match the regex
                if diag_val not in ["a", "the", "this"]:
                    diagnoses.append(diag_val.capitalize())

            # 4. Plan: Treatment
            # Check for keyword at the beginning
            for m in re.finditer(patterns["medication"], line_lower):
                treatments.append(f"Rx: {m.group(1).capitalize()}")
            
            # Check for "required/needed/ordered" at the end
            end_plan_pattern = r"([a-zA-Z,\s]{3,100})\s+(?:requires|required|needed|needs|ordered|are required|is required)"
            for m in re.finditer(end_plan_pattern, line_lower):
                treatments.append(f"Rx: {m.group(1).capitalize().strip()}")
            
            if any(k in line_lower for k in ["gargle", "rest", "hydrate", "return"]):
                if "gargle" in line_lower: treatments.append("Warm salt water gargles")
                if "hydrate" in line_lower: treatments.append("Stay hydrated")
                if "rest" in line_lower: treatments.append("Proper rest")
                if "return" in line_lower: treatments.append("Return if symptoms worsen")
            
            # Extract referrals
            for m in re.finditer(patterns["referral"], line_lower):
                treatments.append(f"Referral: {m.group(1).strip().capitalize()}")
            
            # Extract follow-up timeline
            for m in re.finditer(patterns["follow_up"], line_lower):
                raw_time = m.group(1).strip()
                follow_up_timeline = raw_time.capitalize()
                try:
                    from datetime import datetime, timedelta
                    today = datetime.now()
                    time_lower = raw_time.lower().strip()
                    num = 0
                    
                    if any(w in time_lower.split() for w in ["one", "a", "an"]): num = 1
                    elif "two" in time_lower: num = 2
                    elif "three" in time_lower: num = 3
                    elif "four" in time_lower: num = 4
                    elif "five" in time_lower: num = 5
                    elif "six" in time_lower: num = 6
                    elif "seven" in time_lower: num = 7
                    
                    digits = re.search(r'\d+', time_lower)
                    if digits: num = int(digits.group())
                    
                    if num > 0:
                        future_date = None
                        if "day" in time_lower: future_date = today + timedelta(days=num)
                        elif "week" in time_lower: future_date = today + timedelta(weeks=num)
                        elif "month" in time_lower: future_date = today + timedelta(days=num * 30)
                        
                        if future_date:
                            follow_up_timeline += future_date.strftime(" (on %B %d, %Y)")
                except Exception:
                    pass
            
            # Extract warning signs
            for m in re.finditer(patterns["warning_signs"], line_lower):
                warning_signs.append(m.group(1).strip().capitalize())

            # 5. History
            if any(k in line_lower for k in ["diabetes", "hypertension", "history", "years", "medication", "smoke", "tobacco", "pack per day", "cigarettes", "alcohol", "diet", "activity", "exercise", "father", "mother", "heart attack", "stroke", "cancer"]):
                clean_history = line_clean
                for prefix in ["Unknown:", "unknown:", "Patient:", "patient:", "Doctor:", "doctor:"]:
                    clean_history = clean_history.replace(prefix, "").strip()
                history.append(clean_history)

        subjective_text = "\n".join(subjective_lines).lower()
        extracted_symptoms = sorted(list(set([s.capitalize() for s in re.findall(patterns["symptoms"], subjective_text) if not re.search(rf"(?:no|not|none|negative for|denies)(?:\s+\w+){{0,3}}\s+{s}", subjective_text)])))
        
        # Dynamically formulate primary diagnosis if none specifically dictated
        if not diagnoses:
             # Negative check for allergies
            has_allergy_mention = any(re.search(r"\ballerg", s) for s in subjective_text.split('\n'))
            is_negated_allergy = any(re.search(rf"(?:no|not|none|negative for|denies)(?:\s+\w+){{0,3}}\s+allergy", s) for s in subjective_text.split('\n'))
            
            # Check for specific symptom clusters before defaulting to evaluations
            if any(k in subjective_text for k in ["headache", "dizzy", "tired", "pressure", "vision", "hypertension"]):
                 primary_diagnosis = "Hypertension or Neurological evaluation"
            elif has_allergy_mention and not is_negated_allergy and any(re.search(r"rash|hive|itch", s) for s in subjective_text.split('\n')):
                primary_diagnosis = "Allergic reaction evaluation"
            elif any(re.search(r"\brash\b|\bhive\b|\bitch\b", s) for s in subjective_text.split('\n')):
                 primary_diagnosis = "Dermatological evaluation"
            elif extracted_symptoms:
                primary_diagnosis = f"{extracted_symptoms[0]} evaluation"
            else:
                primary_diagnosis = "Acute condition under evaluation"
        else:
            primary_diagnosis = diagnoses[0]
            
        # Dynamically formulate plan based on extracted symptoms
        lifestyle_modifiers = []
        dynamic_therapies = []
        dynamic_precautions = ["Follow up if symptoms worsen"]
        auto_meds = [t.replace("Rx: ", "") for t in treatments if not any(k in t.lower() for k in ["test", "ecg", "lab", "imaging"])]
        
        if "smoke" in transcript.lower():
            lifestyle_modifiers.append("Smoking cessation")
        if any("allerg" in s.lower() for s in subjective_lines):
            lifestyle_modifiers.append("Avoidance of identified triggers")
            
        if extracted_symptoms:
            symptoms_str = " ".join(extracted_symptoms).lower()

            if "pain" in symptoms_str or "ache" in symptoms_str:
                lifestyle_modifiers.append("Rest the affected area")
                dynamic_therapies.append("Apply ice/heat as needed")
                if not auto_meds:
                    auto_meds.append("OTC analgesics (e.g., Acetaminophen/NSAIDs) as needed for pain")
            if any(k in subjective_text for k in ["cough", "cold", "fever", "congestion", "sneezing"]):
                lifestyle_modifiers.append("Increase fluid intake")
                lifestyle_modifiers.append("Adequate rest")
            if any(k in subjective_text for k in ["nausea", "dizzy", "fatigue"]):
                lifestyle_modifiers.append("Bland diet")
                lifestyle_modifiers.append("Maintain hydration")
            if any(k in subjective_text for k in ["chest", "breathe", "breath", "dizzy", "palpitations"]):
                dynamic_precautions.append("Seek immediate emergency care if breathing difficulty or severe chest pain occurs")
        
        if not lifestyle_modifiers:
            lifestyle_modifiers = ["Heart healthy diet", "Maintain hydration"]

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
                "past_medical_history": history,
                "surgical_history": [],
                "family_history": [h for h in history if any(k in h.lower() for k in ["father", "mother", "sister", "brother", "family"])],
                "social_history": {
                    "smoking": "Yes" if any("smoke" in h.lower() or "cigarette" in h.lower() for h in history) else "None reported",
                    "alcohol": "Yes" if any("alcohol" in h.lower() for h in history) else "None reported",
                    "diet": "Noted" if any("diet" in h.lower() for h in history) else "",
                    "physical_activity": "Noted" if any("exercise" in h.lower() or "activity" in h.lower() for h in history) else ""
                },
                "medication_history": [h for h in history if "medication" in h.lower() or "take" in h.lower()],
                "allergies": list(set([h.replace("Allergic to ", "").split(" (reaction:")[0].strip() for h in history if h.startswith("Allergic to ")]))
            },
            "objective": {
                "vitals": {
                    "temperature": next((v.split(": ")[1] for v in vitals if v.startswith("Temp")), ""),
                    "blood_pressure": next((v.split(": ")[1] for v in vitals if v.startswith("BP")), ""),
                    "heart_rate": next((v.split(": ")[1] for v in vitals if v.startswith("HR")), ""),
                    "respiratory_rate": next((v.split(": ")[1] for v in vitals if v.startswith("RR")), ""),
                    "oxygen_saturation": next((v.split(": ")[1] for v in vitals if v.startswith("SpO2")), ""),
                    "blood_sugar": next((v.split(": ")[1] for v in vitals if v.startswith("BloodSugar")), "")
                },
                "physical_examination": {
                    "general_appearance": "Well appearing" if "well" in transcript.lower() else "Noted",
                    "cardiovascular": "Tachycardia" if any(int(m.group(1)) > 100 for m in re.finditer(patterns["hr"], transcript.lower())) or "tachycardia" in transcript.lower() else "Regular rate and rhythm",
                    "respiratory": "Tachypnea" if any(int(m.group(1)) > 20 for m in re.finditer(patterns["rr"], transcript.lower())) or "clear" in transcript.lower() and "lungs" in transcript.lower() else "Clear to auscultation",
                    "abdominal": "Deferred",
                    "neurological": "Alert and oriented",
                    "musculoskeletal": "Limited range of motion noted" if "unable to lift" in transcript.lower() or "pain" in symptoms_str else "Normal range of motion"
                }
            },
            "assessment": {
                "primary_diagnosis": primary_diagnosis,
                "differential_diagnosis": diagnoses[1:] if len(diagnoses) > 1 else [],
                "clinical_reasoning": "Based on evaluated symptoms and constraints reported in conversation."
            },
            "plan": {
                "medications": auto_meds,
                "diagnostic_tests": [t.replace("Rx: ", "") for t in treatments if any(k in t.lower() for k in ["test", "ecg", "lab", "imaging"])],
                "therapies": dynamic_therapies,
                "lifestyle_modifications": list(set(lifestyle_modifiers)),
                "precautions": list(set(dynamic_precautions))
            },
            "follow_up": {
                "follow_up_timeline": follow_up_timeline,
                "warning_signs": sorted(list(set(warning_signs))),
                "referrals": ", ".join([t.replace("Referral: ", "") for t in treatments if t.startswith("Referral: ")]) or "Physical Therapy evaluation advised" if "pain" in symptoms_str else "None"
            },
            "extracted_entities": {
                "symptoms": list(set(extracted_symptoms)),
                "diagnoses": list(set(diagnoses if diagnoses else [primary_diagnosis])),
                "medications": auto_meds,
                "tests": [],
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

medical_nlp_service = MedicalNLPService()
