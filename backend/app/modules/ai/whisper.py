import logging
import asyncio
import os
import tempfile
from typing import Optional, List, Dict
from app.core.config import settings

logger = logging.getLogger(__name__)

class WhisperService:
    _model = None

    def warmup(self):
        """
        Pre-loads the model into memory. Call this on app startup.
        """
        if settings.WHISPER_PROVIDER == "local":
            try:
                self._get_model()
                logger.info("Local Whisper model warmup complete.")
            except Exception as e:
                logger.error(f"Whisper warmup failed: {e}")
        else:
            logger.info(f"Skipping local model warmup (Provider: {settings.WHISPER_PROVIDER})")
        return

    def _get_model(self):
        if WhisperService._model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError:
                logger.error("faster-whisper not installed. Local transcription unavailable.")
                return None

            model_size = getattr(settings, "WHISPER_MODEL", "small")
            logger.info(f"Loading local Faster-Whisper model ({model_size})...")
            
            # Use /tmp for model storage on Render/Linux to avoid read-only mount issues
            model_path = os.path.join(os.getcwd(), "models")
            if os.name != "nt" and os.path.exists("/tmp"):
                 model_path = "/tmp/whisper_models"
                 
            if not os.path.exists(model_path):
                try: 
                    os.makedirs(model_path, exist_ok=True)
                except: 
                    model_path = tempfile.gettempdir()
                
            WhisperService._model = WhisperModel(
                model_size, 
                device="cpu", 
                compute_type="int8",
                cpu_threads=max(1, os.cpu_count() or 4),
                download_root=model_path,
                local_files_only=False
            )
            logger.info(f"Faster-Whisper model loaded on CPU (int8): {model_size}")
        return WhisperService._model

    async def transcribe(self, audio_data: bytes, encounter_id: str = "default", provider: Optional[str] = None, **kwargs) -> str:
        """
        Transcribes audio data using OpenAI API or Faster-Whisper.
        """
        if provider is None:
            provider = settings.WHISPER_PROVIDER or "openai"
            
        is_raw_file = kwargs.get("is_raw_file", False)
        
        logger.info(f"Whisper: Starting transcription for {encounter_id} using provider: {provider}")
        
        if provider == "openai":
            if not settings.OPENAI_API_KEY:
                logger.error(f"OpenAI key missing. Cannot use openai provider for {encounter_id}")
                return ""
            try:
                import httpx
                from app.modules.capture.audio_utils import decode_to_pcm
                from pydub import AudioSegment
                
                filename = kwargs.get("filename", "audio.mp3")
                ext = os.path.splitext(filename)[1] or ".mp3"
                if ext.lower() not in [".mp3", ".wav", ".webm", ".m4a", ".ogg"]:
                    ext = ".mp3" # Force standard Whisper-friendly extension
                
                # Use direct file path if it's a raw file or large enough to be one
                if is_raw_file or len(audio_data) > 64000:
                     # Preserve the original extension if known
                     with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                          tmp.write(audio_data)
                          tmp_path = tmp.name
                else:
                    # Small chunk: likely a stream segment that needs PCM decoding
                    try:
                        pcm_audio = decode_to_pcm(audio_data, encounter_id)
                        if not pcm_audio: return ""
                            
                        audio_segment = AudioSegment(
                            data=pcm_audio,
                            sample_width=2,
                            frame_rate=16000,
                            channels=1
                        )
                        
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                            audio_segment.export(tmp.name, format="wav")
                            tmp_path = tmp.name
                    except Exception as e:
                        # Fallback: if pydub/ffmpeg fails, try saving and uploading raw
                        logger.warning(f"Audio processing failed ({e}). Attempting raw upload fallback.")
                        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                            tmp.write(audio_data)
                            tmp_path = tmp.name
                
                try:
                    async with httpx.AsyncClient(timeout=90.0) as client:
                        with open(tmp_path, "rb") as f:
                            # Map extensions to mime types
                            m_map = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4", ".ogg": "audio/ogg"}
                            mtype = m_map.get(os.path.splitext(tmp_path)[1].lower(), "audio/mpeg")
                            
                            files = {"file": (os.path.basename(tmp_path), f, mtype)}
                            data = {
                                "model": "whisper-1",
                                "language": "en",
                                "prompt": "Medical consultation context. High accuracy required."
                            }
                            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                            
                            response = await client.post(
                                "https://api.openai.com/v1/audio/transcriptions",
                                headers=headers,
                                files=files,
                                data=data
                            )
                            if response.status_code != 200:
                                logger.error(f"OpenAI API Error ({response.status_code}): {response.text}")
                                return None
                                
                            text = response.json().get("text", "")
                            logger.info(f"OpenAI transcription OK: '{text[:50]}...'")
                            return text.strip()
                finally:
                    if os.path.exists(tmp_path):
                        try: os.unlink(tmp_path)
                        except: pass
            except Exception as e:
                logger.error(f"OpenAI Whisper API error: {e}.")
                return None


        if provider == "local":
            tmp_path = None
            try:
                from app.modules.capture.audio_utils import suppress_noise, decode_to_pcm
                from pydub import AudioSegment
                
                # If it's a raw file or PCM decoding failed but we have significant data, 
                # maybe it's already a valid format (mp3/wav) that whisper can read directly.
                pcm_audio = None
                if not is_raw_file:
                    pcm_audio = decode_to_pcm(audio_data, encounter_id)
                
                if (is_raw_file or not pcm_audio) and len(audio_data) > 1000:
                    logger.info(f"Using direct transcription for {encounter_id} ({len(audio_data)} bytes).")
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".raw_audio") as tmp_file:
                        tmp_file.write(audio_data)
                        tmp_path = tmp_file.name
                elif not pcm_audio:
                    # If we couldn't decode AND it wasn't a raw file, it's an error or garbage
                    return None
                else:
                    # Normal path: PCM -> Suppress Noise -> WAV
                    cleaned_pcm = suppress_noise(pcm_audio)
                    cleaned_segment = AudioSegment(
                        data=cleaned_pcm,
                        sample_width=2,
                        frame_rate=16000,
                        channels=1
                    )
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                        cleaned_segment.export(tmp_file.name, format="wav")
                        tmp_path = tmp_file.name
                
                model = self._get_model()
                if model is None:
                    # Robust failover to API-based providers if local model fails to load (common on low-RAM environments like Render)
                    if settings.OPENAI_API_KEY:
                        logger.warning(f"Local Whisper model failed to load. Falling back to OpenAI for {encounter_id}")
                        return await self.transcribe(audio_data, encounter_id, provider="openai", **kwargs)
                    elif settings.GROQ_API_KEY:
                        logger.warning(f"Local Whisper model failed to load. Falling back to Groq for {encounter_id}")
                        return await self.transcribe(audio_data, encounter_id, provider="groq", **kwargs)
                    
                    logger.error(f"No transcription providers available or configured for {encounter_id}")
                    return ""

                loop = asyncio.get_event_loop()
                
                def process_audio(m):
                    initial_prompt = (
                        "Medical Consultation. Everything must be transcribed in professional medical English."
                    )
                    vad_params = {"min_speech_duration_ms": 100, "threshold": 0.3}
                    
                    segments, info = m.transcribe(
                        tmp_path, 
                        beam_size=5,
                        vad_filter=True,
                        vad_parameters=vad_params,
                        initial_prompt=initial_prompt,
                        task="transcribe", 
                        best_of=5
                    )
                    
                    full_text = []
                    for segment in segments:
                        full_text.append(segment.text)
                    
                    return " ".join(full_text).strip()

                from typing import cast
                text = cast(str, await loop.run_in_executor(None, process_audio, model))
                
                if tmp_path and os.path.exists(tmp_path):
                    try: os.unlink(tmp_path)
                    except: pass
                
                # Hallucination filter - relaxed for integration endpoints
                lower_text = text.lower()
                hallucinations = ["thank you.", "thanks for watching.", "subscribe.", "beep", "you"]
                if (lower_text in hallucinations and len(text) < 15) or len(text) < 2:
                    logger.warning(f"Whisper hallucination detected or empty: '{text}'")
                    return ""
                
                logger.info(f"Whisper transcription OK: '{text[:80]}...' " if len(text) > 80 else f"Whisper transcription OK: '{text}'")
                return text

            except Exception as e:
                logger.error(f"Faster-Whisper local transcription error: {e}.")
                if tmp_path and os.path.exists(tmp_path):
                    try: os.unlink(tmp_path)
                    except: pass
                return None

        return ""

    async def transcribe_file(self, file_path: str) -> List[Dict]:
        """
        Transcribes a full audio file and returns segments.
        """
        if settings.WHISPER_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=180.0) as client:
                    with open(file_path, "rb") as f:
                        fname = os.path.basename(file_path)
                        mtype = "audio/wav"
                        if fname.endswith(".webm"): mtype = "audio/webm"
                        elif fname.endswith(".mp3"): mtype = "audio/mpeg"
                        
                        files = {"file": (fname, f, mtype)}
                        data = {
                            "model": "whisper-1",
                            "response_format": "verbose_json",
                            "language": "en",
                        }
                        headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                        
                        response = await client.post(
                            "https://api.openai.com/v1/audio/transcriptions",
                            headers=headers,
                            files=files,
                            data=data
                        )
                        response.raise_for_status()
                        result_json = response.json()
                        
                        segments = []
                        for s in result_json.get("segments", []):
                            segments.append({
                                "start": s.get("start", 0.0),
                                "end": s.get("end", 0.0),
                                "text": s.get("text", "").strip(),
                                "speaker": "Unknown"
                            })
                        return segments
            except Exception as e:
                logger.error(f"OpenAI File Transcription Error: {e}.")
                return []
        
        try:
            if not os.path.exists(file_path) or os.path.getsize(file_path) < 100:
                return []
                
            model = self._get_model()
            if model is None:
                return []
                
            loop = asyncio.get_event_loop()
            
            def process(m):
                try:
                    segments, info = m.transcribe(
                        file_path,
                        beam_size=5,
                        vad_filter=True,
                        initial_prompt="Medical Consultation.",
                    )
                    results = []
                    for segment in segments:
                        results.append({
                            "start": segment.start,
                            "end": segment.end,
                            "text": segment.text.strip(),
                            "speaker": "Unknown" 
                        })
                    return results
                except Exception as e:
                    logger.error(f"Faster-Whisper failure: {e}")
                    return []
                
            from typing import cast
            return cast(List[Dict], await loop.run_in_executor(None, process, model))
        except Exception as e:
            logger.error(f"Whisper script error: {e}")
            return []

whisper_service = WhisperService()
