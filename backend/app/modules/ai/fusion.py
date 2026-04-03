import logging
import os
import json
import asyncio
import struct
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from app.modules.ai.whisper import whisper_service
from app.modules.ai.diarization import diarization_service
from app.modules.ai.media_pipe import media_pipe_service
from app.modules.ai.medical_nlp import medical_nlp_service
from app.modules.automation.orders import order_automation
from app.modules.automation.billing_service import billing_service
from app.models.encounter import Encounter, SOAPNote
from app.core.config import settings
from app.core.encryption import encrypt_bytes, decrypt_bytes
from app.modules.ai.vision import vision_service

from beanie import PydanticObjectId
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

class AIFusion:
    async def process_encounter_stream(self, encounter_id: str, audio_chunk: Optional[bytes] = None, video_frame: Optional[bytes] = None, iot_data: Optional[Dict] = None, live: bool = False):
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

        # 1. Save Raw Audio to Disk (Only if audio_chunk is provided)
        pcm_data = b""
        if audio_chunk:
            if not encounter.recording_path:
                recording_dir = os.path.join(os.getcwd(), "recordings")
                os.makedirs(recording_dir, exist_ok=True)
                encounter.recording_path = os.path.join(recording_dir, f"{encounter_id}.webm")
            
            # Append the raw WebM cluster/chunk perfectly retaining stream continuity (ENCRYPTED)
            with open(encounter.recording_path, "ab") as f:
                enc_chunk = encrypt_bytes(audio_chunk)
                # Write 4 bytes length then the chunk
                import struct
                f.write(struct.pack("I", len(enc_chunk)))
                f.write(enc_chunk)
                
            pcm_data = decode_to_pcm(audio_chunk, str(encounter.id))

        # 1.5. Visual Analysis (DISABLED FOR PRIVACY)
        new_vision_indicators = {}
        
        # 2. VAD-based Speaker Toggling (DISABLED)
        assigned_role = "Doctor"

        # 3. Live Transcription
        if not live:
             await encounter.save()
             return {"status": "listening"}

        if not audio_chunk:
             return {"status": "active", "vitals": encounter.vitals}

        raw_text = await whisper_service.transcribe(audio_chunk, str(encounter.id))
        if not raw_text.strip():
             return {"status": "active", "vitals": encounter.vitals}

        # 4. Consolidated AI Insights
        ai_insights = await medical_nlp_service.combined_chunk_analysis(raw_text, assigned_role)
        
        display_text = ai_insights.get("cleaned_text", raw_text)

        # 5. Vitals Extraction (STRICT CONVERSATIONAL ONLY - NO SIMULATION)
        extracted_vitals = ai_insights.get("vitals", {})
        if extracted_vitals:
            mapping = {"temp": "temperature", "bp": "blood_pressure", "hr": "heart_rate", "rr": "respiratory_rate", "spo2": "oxygen_saturation"}
            for k, v in extracted_vitals.items():
                internal_key = mapping.get(k)
                if internal_key and internal_key in encounter.vitals and v:
                    encounter.vitals[internal_key]["value"] = str(v)
                    try:
                        num_v = float(str(v).split('/')[0])
                        if not encounter.vitals[internal_key].get("trend"): encounter.vitals[internal_key]["trend"] = []
                        encounter.vitals[internal_key]["trend"].append({"value": num_v, "timestamp": datetime.utcnow().isoformat()})
                    except: pass

        # 7. Incremental SOAP & Billing
        soap_section = ai_insights.get("soap_section", "none")
        soap_content = ai_insights.get("soap_content", "")
        
        if soap_section != "none" and soap_content:
            from app.models.encounter import SOAPNote
            if not encounter.soap_note:
                encounter.soap_note = SOAPNote()
            
            mapping = {"subjective": "history_of_present_illness", "objective": "physical_examination", "assessment": "clinical_reasoning", "plan": "precautions"}
            section_data = getattr(encounter.soap_note, soap_section, {})
            if isinstance(section_data, dict):
                target_key = mapping.get(soap_section)
                if soap_section == "objective":
                    pe = section_data.get("physical_examination", {})
                    pe["general_appearance"] = (pe.get("general_appearance", "") + "\n" + soap_content).strip()
                    section_data["physical_examination"] = pe
                elif target_key:
                    section_data[target_key] = (section_data.get(target_key, "") + "\n" + soap_content).strip()
                setattr(encounter.soap_note, soap_section, section_data)

        # Quick rule-based entities for UI feedback
        nlp_insights = await medical_nlp_service.extract_clinical_entities(display_text)
        billing_suggestions = await medical_nlp_service.extract_billing_codes(display_text)
        
        current_billing = encounter.billing_codes or []
        existing_codes = {c["code"] if isinstance(c, dict) else str(c) for c in current_billing}
        for b in billing_suggestions:
            if (b["code"] if isinstance(b, dict) else str(b)) not in existing_codes:
                current_billing.append(b)
        encounter.billing_codes = current_billing

        # Final Persistence
        timestamp = datetime.utcnow().isoformat()
        if encounter.transcript is None: encounter.transcript = []
        encounter.transcript.append({"speaker": assigned_role, "text": display_text, "timestamp": timestamp})
        encounter.updated_at = datetime.utcnow()
        await encounter.save()

        # Update indicators
        soap_update = {
            "section": soap_section,
            "cleaned_text": soap_content
        } if soap_section != "none" else None
        new_emotions = [] # Placeholder for now as it's disabled for privacy

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
        Diarizes and transcribes an encounter in batch mode from a saved file.
        """
        try:
            # 1. Get Encounter
            from beanie import PydanticObjectId
            try:
                from bson.objectid import ObjectId
                if not ObjectId.is_valid(encounter_id):
                    encounter = await Encounter.find_one(Encounter.id == encounter_id)
                else:
                    encounter = await Encounter.get(PydanticObjectId(encounter_id))
            except:
                encounter = None
    
            if not encounter or not encounter.recording_path:
                logger.warning(f"Batch process skipped for {encounter_id}: No encounter or recording path.")
                return None
    
            logger.info(f"Starting batch transcription for {encounter_id}...")
            
            encounter_path = encounter.recording_path
            
            # 0. Decrypt if file is encrypted (Check if it has our structure)
            # Finalized .wav files are NOT encrypted. Raw .webm chunks ARE encrypted.
            if os.path.exists(encounter_path) and encounter_path.endswith(".webm"):
                try:
                    decrypted_path = encounter_path.replace(".webm", "_decrypted.wav")
                    import struct
                    # Check if we should decrypt (simple heuristic: first 4 bytes are segment length)
                    with open(encounter_path, "rb") as f_in:
                        header = f_in.read(4)
                    
                    # If it looks like a WAV (starts with 'RIFF'), don't decrypt
                    if header == b'RIFF':
                        logger.info("File is already a WAV, skipping decryption.")
                    else:
                        logger.info(f"Decrypting {encounter_id} stream data...")
                        with open(encounter_path, "rb") as f_in, open(decrypted_path, "wb") as f_out:
                            while True:
                                len_data = f_in.read(4)
                                if not len_data: break
                                if len(len_data) < 4: break
                                chunk_len = struct.unpack("I", len_data)[0]
                                chunk_data = f_in.read(chunk_len)
                                if not chunk_data: break
                                try:
                                    f_out.write(decrypt_bytes(chunk_data))
                                except Exception as decrypt_err:
                                    logger.error(f"Chunk decryption failed: {decrypt_err}")
                                    break
                        encounter_path = decrypted_path
                except Exception as e:
                    logger.error(f"Decryption failed during batch processing: {e}")
    
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
            segments = []
            try:
                segments = await whisper_service.transcribe_file(encounter_path)
            except Exception as e:
                logger.error(f"Batch transcription failed: {e}")
            
            if not segments:
                logger.warning(f"No speech detected in {encounter_id}.")
                return None
    
            # 2. Speaker Differentiation (Batch Diarization)
            processed_transcript = []
            try:
                import wave
                with wave.open(encounter_path, 'rb') as wav:
                    params = wav.getparams()
                    raw_audio = wav.readframes(params.nframes)
                
                last_role = "Doctor" # Initial assumption for stateful tracking
                
                for seg in segments:
                    # Generic placeholder ID based on diarization
                    try:
                        start_byte = int(seg["start"] * 32000)
                        end_byte = int(seg["end"] * 32000)
                        segment_audio = raw_audio[start_byte:end_byte]
                        speaker_id = await diarization_service.get_speaker_id(segment_audio)
                    except:
                        # Fallback to alternate labels if embedding fails
                        speaker_id = f"Speaker {1 if i % 2 == 0 else 2}"
                    
                    processed_transcript.append({
                        "speaker": speaker_id,
                        "text": seg["text"],
                        "timestamp": (encounter.created_at + timedelta(seconds=seg["start"])).isoformat() if encounter.created_at else datetime.utcnow().isoformat()
                    })
                    
                # ── GLOBAL ROLE IDENTIFICATION (NEW SUPERIOR LOGIC) ───────────────────────
                # Instead of heuristic-guessing per segment, we send the whole transcript
                # to the LLM to identify 'Doctor' and 'Patient' roles precisely.
                try:
                    import re
                    raw_text_transcript = "\n".join([f"{t['speaker']}: {t['text']}" for t in processed_transcript])
                    identified_transcript = await medical_nlp_service.identify_transcript_roles(raw_text_transcript)
                    
                    if identified_transcript:
                        # SUPERIOR ROBUST PARSING: Only update lines that match the role structure
                        llm_lines = [l.strip() for l in identified_transcript.split('\n') if re.match(r"^(Doctor|Patient):", l.strip(), re.I)]
                        
                        # If LLM returned exactly what we expected, map it. 
                        # Otherwise use a heuristic to avoid breaking the sequence.
                        if len(llm_lines) == len(processed_transcript):
                            for i, line in enumerate(llm_lines):
                                role_match = re.match(r"^(Doctor|Patient):\s*(.*)", line, re.I)
                                if role_match:
                                    processed_transcript[i]["speaker"] = role_match.group(1).capitalize()
                                    processed_transcript[i]["text"] = role_match.group(2).strip()
                        else:
                            logger.warning(f"LLM Role ID line mismatch: expected {len(processed_transcript)}, got {len(llm_lines)}. Falling back to greedy matching.")
                            target_ptr = 0
                            for line in llm_lines:
                                if target_ptr < len(processed_transcript):
                                    role_match = re.match(r"^(Doctor|Patient):\s*(.*)", line, re.I)
                                    if role_match:
                                        processed_transcript[target_ptr]["speaker"] = role_match.group(1).capitalize()
                                        # Only update text if it's very similar to avoid losing data
                                        # processed_transcript[target_ptr]["text"] = role_match.group(2).strip()
                                        target_ptr += 1
                except Exception as id_err:
                    logger.error(f"Global role identification failed: {id_err}")
                    # Fallback to simple alternating if identification fails
                    for i, t in enumerate(processed_transcript):
                        if "Speaker" in t["speaker"]:
                            t["speaker"] = "Doctor" if i % 2 == 0 else "Patient"
            except Exception as e:
                logger.error(f"Diarization sequence failure: {e}")
                # Fallback: Just use the raw segments with alternating "Doctor"/"Patient"
                if not processed_transcript:
                    for i, seg in enumerate(segments):
                        processed_transcript.append({
                            "speaker": "Doctor" if i % 2 == 0 else "Patient",
                            "text": seg["text"],
                            "timestamp": (encounter.created_at + timedelta(seconds=seg["start"])).isoformat() if encounter.created_at else datetime.utcnow().isoformat()
                        })
    
            # 3. Save Final Transcript
            encounter.transcript = processed_transcript
            await encounter.save()
            return encounter
        except Exception as e:
            logger.error(f"Global batch process failure for {encounter_id}: {e}")
            return None

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

    async def generate_final_summary(self, encounter_id: str, background_tasks: Optional[Any] = None):
        """
        Aggregates the entire encounter context into a professional SOAP note.
        Parallelizes sub-tasks and uses background tasks for external sync to reduce latency.
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
        try:
            # 1. Map SOAP Sections with fallbacks to ensure no info is missing
            encounter.soap_note = SOAPNote(
                subjective=soap_data.get("subjective", {}),
                patient_history=soap_data.get("patient_history", {}),
                objective=soap_data.get("objective", {}),
                assessment=soap_data.get("assessment", {}),
                plan=soap_data.get("plan", {}),
                follow_up=soap_data.get("follow_up", {}),
                billing=clinical_info.get("billing", {}),
                clean_transcript=clinical_info.get("clean_conversation", ""),
                raw_transcript=full_transcript,
                extracted_diagnosis=soap_data.get("extracted_diagnosis", []),
                extracted_symptoms=soap_data.get("extracted_symptoms", []),
                extracted_vitals=clinical_info.get("soap", {}).get("objective", {}).get("vitals", {}),
                generated_at=datetime.utcnow()
            )
        except Exception as e:
            logger.error(f"Critical SOAPNote creation failure: {e}")
            # Ensure we have at least a default object to avoid downstream crashes
            encounter.soap_note = SOAPNote(raw_transcript=full_transcript)
        
        # 2. Extract ICD-10 Codes from extracted diagnoses (Complete ICD Mapping)
        try:
            from app.modules.ai.icd10_lookup import icd10_service
            icd10_results = []
            
            # Use seen set to avoid duplicates
            seen_codes = set()
            
            for diag_item in encounter.soap_note.extracted_diagnosis:
                diag_name = ""
                llm_code = None
                
                if isinstance(diag_item, dict):
                    diag_name = diag_item.get("name", "")
                    llm_code = diag_item.get("icd10")
                else:
                    diag_name = diag_item
                
                if not diag_name:
                    continue

                # Search by LLM code if provided, otherwise by name
                matches = icd10_service.lookup(llm_code or diag_name, limit=1)
                
                if matches:
                    match = matches[0]
                    if match["code"] not in seen_codes:
                        icd10_results.append({
                            "code": match["code"],
                            "description": match["description"],
                            "confidence": match["confidence"],
                            "confirmed": False
                        })
                        seen_codes.add(match["code"])
                elif llm_code:
                    # Fallback to LLM code even if not in our database
                    if llm_code not in seen_codes:
                        icd10_results.append({
                            "code": llm_code,
                            "description": diag_name,
                            "confidence": 0.8,
                            "confirmed": False
                        })
                        seen_codes.add(llm_code)
            
            encounter.icd10_codes = icd10_results
        except Exception as e:
            logger.error(f"ICD-10 processing failed: {e}")

        
        # 3. Automated Tasks (PARALLELIZED for speed)
        try:
            # Run independent tasks in parallel
            tasks = [
                order_automation.generate_lab_orders(encounter.soap_note.plan),
                order_automation.generate_prescriptions(encounter.soap_note.plan),
                billing_service.generate_claim(encounter_id, encounter.soap_note, encounter_obj=encounter)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Unpack results
            encounter.lab_orders = results[0] if not isinstance(results[0], Exception) else []
            encounter.prescriptions = results[1] if not isinstance(results[1], Exception) else []
            
            billing_result = results[2] if not isinstance(results[2], Exception) else {"success": False}
            if billing_result.get("success"):
                encounter.invoice_id = billing_result.get("invoice_id")
                encounter.billing_codes = billing_result.get("billing_codes", [])
                encounter.billing_amount = billing_result.get("total_amount")
                encounter.billing_currency = billing_result.get("currency", "INR")
                # Also sync back to the SOAP note for UI consistency
                if encounter.soap_note:
                    current_soap_billing = encounter.soap_note.billing or {}
                    if isinstance(current_soap_billing, str): current_soap_billing = {} # Recover from previous stringification
                    
                    if not current_soap_billing.get("cpt_codes") or not any(c.get("code") for c in current_soap_billing.get("cpt_codes", [])):
                        encounter.soap_note.billing = {
                            "cpt_codes": [
                                {"code": c.get("code"), "description": c.get("description"), "reasoning": c.get("reasoning")}
                                for c in encounter.billing_codes if c.get("system") == "CPT"
                            ]
                        }
            else:
                encounter.billing_amount = encounter.billing_amount or 250.0

        except Exception as e:
            logger.error(f"Parallel automation failed: {e}")
            encounter.billing_amount = encounter.billing_amount or 250.0
        
        # C. Sync to EHR (FHIR) - EXECUTED IN BACKGROUND for immediate response
        if background_tasks:
            from app.modules.automation.fhir_service import fhir_service
            background_tasks.add_task(fhir_service.sync_encounter, encounter)
            encounter.fhir_status = "syncing"
        else:
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
        
        # Return a dict containing both SOAP note and automation totals to help frontend
        return {
            "soap": encounter.soap_note,
            "billing_amount": encounter.billing_amount,
            "billing_codes": encounter.billing_codes,
            "invoice_id": encounter.invoice_id,
            "currency": encounter.billing_currency
        }

    async def generate_summary_from_text(self, raw_text: str, patient_id: str = "Anonymous", background_tasks: Optional[Any] = None):
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
            
            if encounter.transcript is None: encounter.transcript = []
            encounter.transcript.append({
                "speaker": current_speaker,
                "text": text,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        await encounter.insert()

        # After processing all transcript segments, extract NLP insights
        full_transcript_text = "\n".join([f'{t["speaker"]}: {t["text"]}' for t in encounter.transcript])

        # Parallelize NLP and Billing Extraction
        try:
            tasks = [
                medical_nlp_service.extract_clinical_entities(full_transcript_text),
                medical_nlp_service.extract_billing_codes(full_transcript_text)
            ]
            results = await asyncio.gather(*tasks)
            insights_data = results[0]
            billing_codes_extracted = results[1]
        except Exception as e:
            logger.error(f"Parallel extractions failed: {e}")
            insights_data = {}
            billing_codes_extracted = []
        
        # Update billing codes in encounter (additive)
        current_billing = encounter.billing_codes or []
        new_billing_codes = [c["code"] for c in billing_codes_extracted if isinstance(c, dict) and c.get("code") and c["code"] not in current_billing]
        if new_billing_codes:
            encounter.billing_codes = current_billing + new_billing_codes

        # If you want to store extracted entities directly in the encounter, you'd need an `nlp_insights` field
        # For example:
        # encounter.nlp_insights = insights_data.get("entities", [])
        
        await encounter.save() # Save the updated billing codes and potential insights

        # 3. Generate final summary using existing logic
        soap_note = await self.generate_final_summary(str(encounter.id), background_tasks=background_tasks)

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
        
        # 5. Final Reload (to return the fully populated object including SOAP)
        await encounter.sync()
        return encounter

ai_fusion = AIFusion()
