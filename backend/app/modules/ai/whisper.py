import logging
import asyncio
import os
import tempfile
from typing import Optional, List, Dict
from app.core.config import settings
from faster_whisper import WhisperModel
from app.modules.capture.audio_utils import suppress_noise

logger = logging.getLogger(__name__)

class WhisperService:
    _model = None

    def warmup(self):
        """
        Pre-loads the model into memory. Call this on app startup.
        """
        try:
            self._get_model()
            logger.info("Whisper model warmup complete.")
        except Exception as e:
            logger.error(f"Whisper warmup failed: {e}")

    def _get_model(self):
        if WhisperService._model is None:
            model_size = getattr(settings, "WHISPER_MODEL", "small")
            logger.info(f"Loading local Faster-Whisper model ({model_size})...")
            model_path = os.path.join(os.getcwd(), "models")
            if not os.path.exists(model_path):
                os.makedirs(model_path)
                
            WhisperService._model = WhisperModel(
                model_size, 
                device="cpu", 
                compute_type="int8",
                cpu_threads=8,
                download_root=model_path,
                local_files_only=False
            )
            logger.info(f"Faster-Whisper model loaded on CPU (int8): {model_size}")
        return WhisperService._model

    async def transcribe(self, audio_data: bytes, encounter_id: str = "default", provider: Optional[str] = None) -> str:
        """
        Transcribes audio data using OpenAI API or Faster-Whisper.
        """
        if provider is None:
            provider = settings.WHISPER_PROVIDER or "openai"
            
        if provider == "mock":
            return "Mock: The patient is reporting symptoms."
            
        if provider == "openai" and settings.OPENAI_API_KEY:
            try:
                import httpx
                # Save to a small buffer-like temp file for OpenAI
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(audio_data)
                    tmp_path = tmp.name
                
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        with open(tmp_path, "rb") as f:
                            # Frontend sends WebM from MediaRecorder
                            files = {"file": ("audio.webm", f, "audio/webm")}
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
                            response.raise_for_status()
                            text = response.json().get("text", "")
                            return text.strip()
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            except Exception as e:
                logger.error(f"OpenAI Whisper API error: {e}. Falling back to local.")
                provider = "local"

        if provider == "local":
            tmp_path = None
            try:
                from app.modules.capture.audio_utils import suppress_noise, decode_to_pcm
                from pydub import AudioSegment
                
                # 1. Decode & Suppress
                pcm_audio = decode_to_pcm(audio_data, encounter_id)
                if not pcm_audio:
                    return ""
                    
                cleaned_pcm = suppress_noise(pcm_audio)
                
                # 2. Convert to stable WAV for Faster-Whisper
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
                    return await self.transcribe(audio_data, encounter_id, provider="mock")

                loop = asyncio.get_event_loop()
                
                def process_audio(m):
                    initial_prompt = (
                        "Medical Consultation. Everything must be transcribed in professional medical English. "
                        "Translate any non-English speech directly to English."
                    )
                    vad_params = {"min_speech_duration_ms": 100, "threshold": 0.3}
                    
                    segments, info = m.transcribe(
                        tmp_path, 
                        beam_size=5,
                        vad_filter=True,
                        vad_parameters=vad_params,
                        initial_prompt=initial_prompt,
                        language="en",
                    )
                    
                    full_text = []
                    for segment in segments:
                        full_text.append(segment.text)
                    
                    result = " ".join(full_text).strip()
                    return result

                from typing import cast
                text = cast(str, await loop.run_in_executor(None, process_audio, model))
                
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                
                # Hallucination filter
                lower_text = text.lower()
                hallucinations = ["thank you.", "thanks for watching.", "subscribe.", "beep"]
                
                if lower_text in hallucinations or len(text) < 2:
                    return ""
                
                # Check for extreme word repetition (looping)
                words = lower_text.split()
                if len(words) > 8:
                    unique_words = set(words)
                    if len(unique_words) / len(words) < 0.2:
                        return ""

                logger.info(f"Whisper transcription OK: '{text[:80]}...' " if len(text) > 80 else f"Whisper transcription OK: '{text}'")
                return text

            except Exception as e:
                logger.error(f"Faster-Whisper local transcription error: {e}. Falling back to mock.")
                if tmp_path and os.path.exists(tmp_path):
                    try: os.unlink(tmp_path)
                    except: pass
                return ""

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
                        
                        # Map verbose_json segments to our segment format
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
                logger.error(f"OpenAI File Transcription Error: {e}, falling back to local.")
        
        try:
            if not os.path.exists(file_path) or os.path.getsize(file_path) < 100:
                logger.warning(f"Audio file {file_path} is too small or missing, skipping transcription.")
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
                        initial_prompt="Medical Consultation. Translate everything to English.",
                        language="en"
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
                    logger.error(f"Faster-Whisper model failure on file {file_path}: {e}")
                    return []
                
            from typing import cast
            return cast(List[Dict], await loop.run_in_executor(None, process, model))
        except Exception as e:
            logger.error(f"Whisper script error in transcribe_file: {e}")
            return []

whisper_service = WhisperService()
