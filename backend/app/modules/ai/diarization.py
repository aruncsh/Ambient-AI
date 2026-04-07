import numpy as np
import logging
from datetime import datetime
from typing import List, Dict, Optional
import huggingface_hub

# Try to import heavy dependencies
try:
    import torch
    import torchaudio
    import webrtcvad
    from speechbrain.inference.speaker import EncoderClassifier
    HAS_LOCAL_DIARIZATION = True
except ImportError:
    HAS_LOCAL_DIARIZATION = False
    logging.getLogger(__name__).warning("Local diarization dependencies (torch, webrtcvad, speechbrain) not found. Diarization will be disabled.")

# Patch for torchaudio and speechbrain compatibility
if HAS_LOCAL_DIARIZATION:
    if not hasattr(torchaudio, "list_audio_backends"):
        torchaudio.list_audio_backends = lambda: []

    # SpeechBrain compatibility patch for newer huggingface_hub
    _original_hf_hub_download = huggingface_hub.hf_hub_download
    def patched_hf_hub_download(*args, **kwargs):
        if "use_auth_token" in kwargs:
            kwargs["token"] = kwargs.pop("use_auth_token")
        return _original_hf_hub_download(*args, **kwargs)
    huggingface_hub.hf_hub_download = patched_hf_hub_download

logger = logging.getLogger(__name__)

class DiarizationService:
    def __init__(self):
        self.encoder = None
        self.speaker_embeddings = [] # List of (embedding, role)
        self.threshold = 0.7 # Conservative threshold for distinct speaker detection
        
        if HAS_LOCAL_DIARIZATION:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.vad = webrtcvad.Vad(3) # Aggressiveness 3
        else:
            self.device = "cpu"
            self.vad = None
            
        self.current_role = "Clinician"
        self.silence_start_time = None
        self.is_speaking = False

    def _get_encoder(self):
        if not HAS_LOCAL_DIARIZATION:
            return None
            
        if self.encoder is None:
            try:
                logger.info(f"Loading SpeechBrain ECAPA-TDNN model on {self.device}...")
                self.encoder = EncoderClassifier.from_hparams(
                    source="speechbrain/spkrec-ecapa-voxceleb",
                    savedir="models/speechbrain_spkrec",
                    run_opts={"device": self.device}
                )
            except Exception as e:
                logger.error(f"Failed to load SpeechBrain encoder: {e}")
                return None
        return self.encoder

    def update_speaker_toggle(self, audio_pcm: bytes, sample_rate: int = 16000) -> str:
        """
        Uses WebRTC VAD to detect pauses > 800ms and toggles speaker.
        """
        if not HAS_LOCAL_DIARIZATION or self.vad is None:
            return self.current_role

        # webrtcvad expects 10, 20 or 30ms frames
        frame_duration_ms = 30
        frame_size = int(sample_rate * frame_duration_ms / 1000) * 2
        
        has_speech = False
        for i in range(0, len(audio_pcm) - frame_size, frame_size):
            frame = audio_pcm[i:i + frame_size]
            try:
                if self.vad.is_speech(frame, sample_rate):
                    has_speech = True
                    break
            except:
                continue
        
        now = datetime.utcnow()
        if not has_speech:
            if self.is_speaking:
                self.silence_start_time = now
                self.is_speaking = False
            elif self.silence_start_time:
                pause_duration = (now - self.silence_start_time).total_seconds() * 1000
                if pause_duration > 2000:
                    # Toggle role
                    self.current_role = "Patient" if self.current_role == "Clinician" else "Clinician"
                    self.silence_start_time = None
                    logger.info(f"VAD: Speaker toggled to {self.current_role} after {pause_duration:.0f}ms pause")
        else:
            self.is_speaking = True
            self.silence_start_time = None
            
        return self.current_role

    async def get_speaker_id(self, audio_chunk: bytes) -> str:
        """
        Identifies speaker based on Voice Embeddings (X-vectors/ECAPA-TDNN).
        """
        if not HAS_LOCAL_DIARIZATION:
            return "Speaker 1"

        encoder = self._get_encoder()
        if not encoder:
            return "Speaker 1"

        try:
            # Convert bytes to tensor
            audio = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
            audio_tensor = torch.tensor(audio).unsqueeze(0)
            
            # Extract embedding
            with torch.no_grad():
                embedding = encoder.encode_batch(audio_tensor)
                embedding = embedding.squeeze(0).squeeze(0) # [1, 1, 192] -> [192]
            
            # Normalize embedding for cosine similarity
            embedding = embedding / torch.norm(embedding)
            
            # Compare with known speakers
            best_score = -1.0
            best_idx = -1
            
            for i, (saved_emb, _) in enumerate(self.speaker_embeddings):
                # Cosine similarity
                score = torch.dot(embedding, saved_emb).item()
                if score > best_score:
                    best_score = score
                    best_idx = i
            
            if best_score > self.threshold:
                # Update embedding (moving average)
                self.speaker_embeddings[best_idx] = (self.speaker_embeddings[best_idx][0] * 0.9 + embedding * 0.1, self.speaker_embeddings[best_idx][1])
                return f"Speaker {best_idx + 1}"
            else:
                # New speaker
                self.speaker_embeddings.append((embedding, None))
                speaker_idx = len(self.speaker_embeddings)
                logger.info(f"New speaker detected via embeddings: Speaker {speaker_idx}")
                return f"Speaker {speaker_idx}"

        except Exception as e:
            logger.error(f"Diarization embedding error: {e}")
            return "Speaker 1"

    def assign_role(self, speaker_id: str, role: str):
        try:
            idx = int(speaker_id.split()[-1]) - 1
            if 0 <= idx < len(self.speaker_embeddings):
                self.speaker_embeddings[idx] = (self.speaker_embeddings[idx][0], role)
        except:
            pass

    def get_role(self, speaker_id: str) -> Optional[str]:
        try:
            idx = int(speaker_id.split()[-1]) - 1
            if 0 <= idx < len(self.speaker_embeddings):
                return self.speaker_embeddings[idx][1]
        except:
            pass
        return None

diarization_service = DiarizationService()
