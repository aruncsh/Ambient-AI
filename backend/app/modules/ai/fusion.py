import logging
import os
import wave
from typing import Dict, List, Optional
from datetime import datetime
from app.modules.ai.whisper import whisper_service
from app.modules.ai.diarization import diarization_service
from app.modules.ai.media_pipe import media_pipe_service
from app.modules.ai.medical_nlp import medical_nlp_service
from app.modules.automation.orders import automation_service
from app.modules.automation.billing_service import billing_service
from app.models.encounter import Encounter, SOAPNote

logger = logging.getLogger(__name__)

from beanie import PydanticObjectId

class AIFusion:
    async def process_encounter_stream(self, encounter_id: str, audio_chunk: bytes, video_frame: Optional[bytes] = None, iot_data: Optional[Dict] = None, live: bool = False):
        """
        Fuses data from multiple sources. Supports both live transcription and silent background recording.
        """
        from app.modules.capture.audio_utils import suppress_noise, decode_to_pcm, append_to_wav
        import os
        import random
        
        try:
            from bson.objectid import ObjectId
            if not ObjectId.is_valid(encounter_id):
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter = await Encounter.get(PydanticObjectId(encounter_id))
        except:
            encounter = None
            
        if not encounter:
            return {"error": "Encounter not found"}

        # 1. Save Raw Audio to Disk
        if not encounter.recording_path:
            recording_dir = os.path.join(os.getcwd(), "recordings")
            os.makedirs(recording_dir, exist_ok=True)
            encounter.recording_path = os.path.join(recording_dir, f"{encounter_id}.webm")
        
        # Append the raw WebM cluster/chunk perfectly retaining stream continuity
        with open(encounter.recording_path, "ab") as f:
            f.write(audio_chunk)
            
        pcm_data = decode_to_pcm(audio_chunk, str(encounter.id))

        # 2. VAD-based Speaker Toggling
        assigned_role = diarization_service.update_speaker_toggle(pcm_data)

        # 3. Live Transcription
        if not live:
            await encounter.save()
            return {"status": "listening"}

        raw_text = await whisper_service.transcribe(audio_chunk, str(encounter.id))
        if not raw_text or not raw_text.strip() or "Transcription Error" in raw_text:
            await encounter.save()
            return {"status": "processing"}

        # 4. Cleaning and Insights
        display_text = raw_text
        try:
            cleaned_entry = await medical_nlp_service.clean_transcript_chunk(raw_text, assigned_role)
            if cleaned_entry and ":" in cleaned_entry:
                llm_speaker, llm_text = cleaned_entry.split(":", 1)
                display_text = llm_text.strip()
                # LLM-aided Role Verification: LLM can override VAD if it's clear
                if llm_speaker.strip() in ["Clinician", "Doctor"]:
                    assigned_role = "Doctor"
                elif llm_speaker.strip() in ["Patient"]:
                    assigned_role = "Patient"
        except Exception as e:
            logger.error(f"Role verification error: {e}")

        # 5. Emotion Analysis (Patient only)
        new_emotions = []
        if assigned_role == "Patient":
            new_emotions = await medical_nlp_service.analyze_emotions(display_text, assigned_role)
            if new_emotions:
                encounter.emotions.extend(new_emotions)

        # 6. Vitals Simulation & Extraction
        # Simulation if no real IoT data provided
        if not iot_data:
            # Simple simulation logic
            current_vitals = encounter.vitals or {}
            simulated = {}
            # Update values slightly move every chunk
            def drift(val, min_v, max_v, step=1):
                try:
                    v = float(val) if val else (min_v + max_v) / 2
                    v += random.uniform(-step, step)
                    return round(max(min(v, max_v), min_v), 1)
                except: return val

            simulated["heart_rate"] = drift(current_vitals.get("heart_rate", {}).get("value"), 60, 100, 2)
            simulated["oxygen_saturation"] = drift(current_vitals.get("oxygen_saturation", {}).get("value"), 95, 100, 0.5)
            # Update encounter vitals object
            for key, val in simulated.items():
                if key in encounter.vitals:
                    encounter.vitals[key]["value"] = str(val)
                    if not encounter.vitals[key].get("trend"): encounter.vitals[key]["trend"] = []
                    encounter.vitals[key]["trend"].append({"value": val, "timestamp": datetime.utcnow().isoformat()})
                    # Keep trend to last 20 points
                    encounter.vitals[key]["trend"] = encounter.vitals[key]["trend"][-20:]

        # NER Extraction of Vitals from text
        extracted_vitals = await medical_nlp_service.extract_vitals_from_text(display_text)
        if extracted_vitals:
            mapping = {"temp": "temperature", "bp": "blood_pressure", "hr": "heart_rate", "rr": "respiratory_rate", "spo2": "oxygen_saturation"}
            for k, v in extracted_vitals.items():
                internal_key = mapping.get(k)
                if internal_key and internal_key in encounter.vitals and v:
                    encounter.vitals[internal_key]["value"] = str(v)
                    # For numeric vitals, add to trend
                    try:
                        num_v = float(str(v).split('/')[0]) # Handle BP
                        encounter.vitals[internal_key]["trend"].append({"value": num_v, "timestamp": datetime.utcnow().isoformat()})
                    except: pass

        # 7. Incremental SOAP Insights
        nlp_insights = await medical_nlp_service.extract_clinical_entities(display_text)
        billing_suggestions = await medical_nlp_service.extract_billing_codes(display_text)
        soap_update = await medical_nlp_service.update_soap_incrementally(str(encounter.id), display_text)
        
        # Update billing codes in encounter (additive)
        current_billing = encounter.billing_codes or []
        for b in billing_suggestions:
            if b["code"] not in current_billing:
                current_billing.append(b["code"])
        encounter.billing_codes = current_billing

        # Persistence
        timestamp = datetime.utcnow().isoformat()
        encounter.transcript.append({
            "speaker": assigned_role,
            "text": display_text,
            "timestamp": timestamp
        })
        encounter.updated_at = datetime.utcnow()
        await encounter.save()

        return {
            "speaker": assigned_role,
            "transcript": display_text,
            "timestamp": timestamp,
            "nlp_insights": nlp_insights.get("entities", []),
            "billing_suggestions": billing_suggestions,
            "soap_update": soap_update,
            "emotions": new_emotions,
            "vitals": encounter.vitals,
            "status": "active"
        }

    async def batch_process_encounter(self, encounter_id: str):
        """
        Transcribes the entire recording and performs speaker differentiation.
        """
        try:
            from bson.objectid import ObjectId
            if not ObjectId.is_valid(encounter_id):
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter = await Encounter.get(PydanticObjectId(encounter_id))
        except:
            encounter = None

        if not encounter or not encounter.recording_path:
            return None

        logger.info(f"Starting batch transcription for {encounter_id}...")
        
        encounter_path = encounter.recording_path
        if encounter_path.endswith(".webm"):
            from pydub import AudioSegment
            wav_path = encounter_path.replace(".webm", ".wav")
            try:
                audio_segment = AudioSegment.from_file(encounter_path)
                audio_segment = audio_segment.set_frame_rate(16000).set_channels(1).set_sample_width(2)
                audio_segment.export(wav_path, format="wav")
                encounter_path = wav_path
                encounter.recording_path = wav_path
                await encounter.save()
            except Exception as e:
                logger.error(f"Failed to convert webm to wav: {e}")

        # 1. Full Transcription
        segments = await whisper_service.transcribe_file(encounter_path)
        
        # 2. Speaker Differentiation (Batch Diarization)
        # We'll use the already established diarization service per segment
        import wave
        with wave.open(encounter_path, 'rb') as wav:
            params = wav.getparams()
            raw_audio = wav.readframes(params.nframes)
        processed_transcript = []
        last_role = "Doctor" # Initial assumption for stateful tracking
        
        for seg in segments:
            # 2.2. Speaker ID & Timestamp
            from datetime import timedelta
            try:
                from app.modules.capture.audio_utils import suppress_noise
                # Get the diarized speaker ID (e.g., "Speaker 1")
                seg_audio = raw_audio[int(seg["start"] * params.framerate * params.sampwidth):int(seg["end"] * params.framerate * params.sampwidth)]
                speaker_id = await diarization_service.get_speaker_id(suppress_noise(seg_audio))
                
                # Role Identification
                # If the speaker_id is specific (not "Speaker 1", etc.), try to use already assigned role
                is_generic = any(g in speaker_id for g in ["Speaker", "Unknown", "User"])
                
                role = None
                if not is_generic:
                    role = diarization_service.get_role(speaker_id)
                
                if not role:
                    # Heuristic based on text content
                    role = self._identify_role(seg["text"], speaker_id, last_role)
                    
                    # Only assign role to the ID if it's NOT a generic/failed diarization label
                    if not is_generic and role in ["Doctor", "Patient"]:
                        diarization_service.assign_role(speaker_id, role)
                
                last_role = role
            except Exception as e:
                logger.error(f"Diarization failed for segment: {e}")
                role = "Speaker 1"

            # Use encounter.created_at as the start time basis
            base_time = encounter.created_at or datetime.utcnow()
            ts = base_time + timedelta(seconds=seg.get("start", 0))
            
            processed_transcript.append({
                "speaker": role,
                "text": seg["text"],
                "timestamp": ts.isoformat()
            })

        encounter.transcript = processed_transcript
        await encounter.save()
        return processed_transcript

    def _identify_role(self, text: str, speaker_id: str, last_role: Optional[str] = None) -> str:
        """
        Heuristic-based speaker identification.
        """
        doctor_score = 0
        patient_score = 0
        
        text_lower = text.lower()
        
        # Doctor clues
        doctor_keywords = [
            "prescribe", "medication", "exam", "history", "symptoms", "dosage", 
            "treatment", "results", "follow", "return", "pharmacy", "take",
            "how many", "since when", "where does", "show me", "breathe", "cough",
            "temperature", "blood", "pressure", "sugar", "diabetic", "pulse",
            "report", "clinical", "signs", "assess", "diagnose", "referral", "fever"
        ]
        
        # Patient clues
        patient_keywords = [
            "pain", "hurts", "feel", "headache", "dizzy", "fatigue", "nausea",
            "coughing", "yesterday", "last week", "sir", "doctor", "doc", 
            "help", "problem", "started", "worse", "better", "itchy", "sore",
            "burning", "tired", "weak", "sleeping", "appetite"
        ]
        
        if text_lower in ["no", "yes", "none", "not really", "yeah"]:
            # Very short responses to questions are likely patient
            patient_score += 1.0

        for kw in doctor_keywords:
            if kw in text_lower: doctor_score += 1.0
            
        for kw in patient_keywords:
            if kw in text_lower: patient_score += 1.0
            
        # Contextual boosts
        if "i have" in text_lower or "i feel" in text_lower or "i'm" in text_lower: patient_score += 1.5
        if text_lower.endswith("?") or any(q in text_lower for q in ["how", "what", "when", "why", "where"]): 
            # Questions are usually from doctors
            doctor_score += 1.5
        
        if "sir" in text_lower or "doctor" in text_lower: patient_score += 1.0
        
        # Stateful boost: Doctor question likely followed by Patient answer
        if last_role == "Doctor" and patient_score >= 0.5: patient_score += 1.0
        if last_role == "Patient" and doctor_score >= 0.5: doctor_score += 1.0

        if patient_score > doctor_score:
            return "Patient"
        elif doctor_score > patient_score:
            return "Doctor"
        else:
            # If ambiguous, prefer alternating roles if the previous one was clear
            if last_role == "Doctor": return "Patient"
            if last_role == "Patient": return "Doctor"
            return speaker_id

    async def generate_final_summary(self, encounter_id: str):
        """
        Aggregates the entire encounter context into a professional SOAP note.
        """
        try:
            from bson.objectid import ObjectId
            if not ObjectId.is_valid(encounter_id):
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter = await Encounter.get(PydanticObjectId(encounter_id))
        except:
            encounter = None
        if not encounter: return None
        
        # Trigger batch transcription if transcript is empty
        if not encounter.transcript and encounter.recording_path:
            await self.batch_process_encounter(encounter_id)
        
        # Aggregate transcript with speaker labels
        full_transcript = "\n".join([f'{t["speaker"]}: {t["text"]}' for t in encounter.transcript])
        
        # Prepare context for the LLM
        context = {
            "vitals": encounter.vitals,
            "visual": ""
        }
        
        if encounter.emotions:
            emotions_list = [e["emotion"] for e in encounter.emotions if "emotion" in e]
            if emotions_list:
                dominant_emotion = max(set(emotions_list), key=emotions_list.count)
                context["visual"] = f"Patient appeared mostly {dominant_emotion}."

        clinical_info = await medical_nlp_service.process_precise_scribe(full_transcript, context=context)
        soap_data = clinical_info.get("soap", {})
        
        # Update encounter with the new SOAP note
        # Map fields correctly to the SOAPNote model
        encounter.soap_note = SOAPNote(
            subjective=soap_data.get("subjective") or {},
            patient_history=soap_data.get("patient_history") or {},
            objective=soap_data.get("objective") or {},
            assessment=soap_data.get("assessment") or {},
            plan=soap_data.get("plan") or {},
            clean_transcript=clinical_info.get("clean_conversation", ""),
            follow_up=clinical_info.get("follow_ups") or {},
            raw_transcript=full_transcript,
            extracted_symptoms=clinical_info.get("extracted_symptoms", []),
            extracted_diagnosis=clinical_info.get("extracted_diagnosis", []),
            generated_at=datetime.utcnow()
        )
        
        # 3. Automated Tasks
        # A. Low-latency mock automation for orders and prescriptions
        encounter.lab_orders = await automation_service.generate_lab_orders(encounter.soap_note.plan)
        encounter.prescriptions = await automation_service.generate_prescriptions(encounter.soap_note.plan)
        
        # B. Automated Billing and Coding
        billing_result = await billing_service.generate_claim(encounter_id, encounter.soap_note)
        if billing_result.get("success"):
            encounter.invoice_id = billing_result.get("invoice_id")
            encounter.billing_codes = [c["code"] for c in billing_result.get("billing_codes", [])]
        
        # C. Sync to EHR (FHIR)
        try:
            from app.modules.automation.fhir_service import fhir_service
            sync_result = await fhir_service.sync_encounter(encounter)
            if sync_result.get("success"):
                encounter.fhir_id = sync_result.get("fhir_id")
                encounter.fhir_status = "synced"
            else:
                encounter.fhir_status = "failed"
        except Exception as e:
            logger.error(f"EHR sync integration error: {e}")
            encounter.fhir_status = "failed"
            
        encounter.status = "completed"
        await encounter.save()
        return encounter.soap_note

    async def generate_summary_from_text(self, raw_text: str, patient_id: str = "Anonymous"):
        """
        Creates a new encounter from raw text and generates a SOAP summary.
        """
        # 1. Create a new encounter
        encounter = Encounter(
            patient_id=patient_id,
            clinician_id="Manual Entry",
            status="active"
        )
        
        # 2. Parse raw text into transcript segments
        # Simple parsing logic: look for "Doctor:" and "Patient:" prefixes
        lines = raw_text.split('\n')
        current_speaker = "Unknown"
        for line in lines:
            line = line.strip()
            if not line: continue
            
            import re
            speaker_match = re.match(r"^(Speaker\s+\d+|Unknown|Patient|Doctor):\s*(.*)$", line, re.I)
            
            if speaker_match:
                prefix = speaker_match.group(1).lower()
                text = speaker_match.group(2).strip()
                if "doctor" in prefix:
                    current_speaker = "Doctor"
                elif "patient" in prefix:
                    current_speaker = "Patient"
                else:
                    # Generic prefix like "Speaker 1" - re-identify
                    current_speaker = self._identify_role(text, speaker_match.group(1))
            else:
                text = line
                # No clear prefix, try to identify role for this line specifically if unknown
                if current_speaker == "Unknown":
                    current_speaker = self._identify_role(text, "Unknown")
            
            if current_speaker == "Unknown":
                current_speaker = self._identify_role(text, "Unknown")
            
            encounter.transcript.append({
                "speaker": current_speaker,
                "text": text,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        await encounter.insert()

        # After processing all transcript segments, extract NLP insights
        full_transcript_text = "\n".join([f'{t["speaker"]}: {t["text"]}' for t in encounter.transcript])

        # Call extract_clinical_entities and extract_billing_codes
        # Note: Assuming self.nlp_service is available and configured
        # If not, you might need to instantiate it or pass it as a dependency.
        # For this edit, I'll assume it's accessible via `medical_nlp_service` as used in generate_final_summary
        
        # 6. NLP Insights (Entities & Billing)
        insights_data = await medical_nlp_service.extract_clinical_entities(full_transcript_text)
        billing_codes_extracted = await medical_nlp_service.extract_billing_codes(full_transcript_text)
        
        # Combine into nlp_insights for the encounter (if such a field exists or is desired)
        # For now, we'll update billing_codes and potentially store entities if needed.
        
        # Update billing codes in encounter (additive)
        current_billing = encounter.billing_codes or []
        new_billing_codes = [c["code"] for c in billing_codes_extracted if c["code"] not in current_billing]
        if new_billing_codes:
            encounter.billing_codes = current_billing + new_billing_codes

        # If you want to store extracted entities directly in the encounter, you'd need an `nlp_insights` field
        # For example:
        # encounter.nlp_insights = insights_data.get("entities", [])
        
        await encounter.save() # Save the updated billing codes and potential insights

        # 3. Generate final summary using existing logic
        soap_note = await self.generate_final_summary(str(encounter.id))
        return {
            "encounter_id": str(encounter.id),
            "soap_note": soap_note
        }

    async def simulate_full_flow(self, mock_data: Dict):
        """
        Aggregates mock data for architectural demonstration.
        """
        return {
            "transcript": "Hello, I've been feeling short of breath lately and have a persistent cough.",
            "nlp_insights": [
                {"type": "Symptom", "value": "Shortness of breath", "confidence": 0.98},
                {"type": "Symptom", "value": "Persistent cough", "confidence": 0.95}
            ],
            "analysis": {
                "assessment": "Possible respiratory infection, further evaluation needed.",
                "extracted_diagnosis": ["Upper Respiratory Infection", "Bronchitis"]
            },
            "status": "simulated"
        }

    async def process_final_batch(self, encounter_id: str, audio_data: bytes):
        """
        Processes the complete audio file at the end of an encounter.
        Saves the file, transcribes, diarizes, and generates the SOAP note.
        """
        # 1. Get/Create Encounter
        from beanie import PydanticObjectId
        try:
            from bson.objectid import ObjectId
            if not ObjectId.is_valid(encounter_id):
                encounter = await Encounter.find_one(Encounter.id == encounter_id)
            else:
                encounter = await Encounter.get(PydanticObjectId(encounter_id))
        except:
            encounter = None

        if not encounter:
            logger.error(f"Encounter {encounter_id} not found for final batch processing.")
            return None

        # 2. Save Full Audio
        recording_dir = os.path.join(os.getcwd(), "recordings")
        os.makedirs(recording_dir, exist_ok=True)
        encounter.recording_path = os.path.join(recording_dir, f"{encounter_id}.wav")
        
        # PCM decoding
        from app.modules.capture.audio_utils import decode_to_pcm, append_to_wav
        pcm_data = decode_to_pcm(audio_data)
        
        # For batch, we overwrite or create fresh
        import wave
        with wave.open(encounter.recording_path, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            wav_file.writeframes(pcm_data)
        
        await encounter.save()

        # 3. Process transcription and diarization
        await self.batch_process_encounter(encounter_id)
        
        # 4. Generate SOAP note
        # Reload encounter to get updated transcript
        await encounter.sync()
        if encounter.transcript:
            await self.generate_final_summary(encounter_id)
        
        # 5. Final Save
        await encounter.save()
        return encounter

ai_fusion = AIFusion()
