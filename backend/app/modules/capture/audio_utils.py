import numpy as np
from scipy.signal import butter, lfilter
import logging
import io
from pydub import AudioSegment

logger = logging.getLogger(__name__)

def butter_highpass(cutoff, fs, order=5):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    return b, a

def highpass_filter(data, cutoff, fs, order=5):
    b, a = butter_highpass(cutoff, fs, order=order)
    y = lfilter(b, a, data)
    return y

# Cache for session headers to handle MediaRecorder chunks
_session_headers = {}

def decode_to_pcm(audio_data: bytes, encounter_id: str = "default", sample_rate: int = 16000) -> bytes:
    """
    Decodes encoded audio (webm, ogg, etc.) to raw PCM 16-bit Mono.
    Handles header-less chunks by caching the first chunk's header.
    """
    try:
        # Try direct decode
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_data))
        
        # If successful AND it's a first chunk, cache the first 2KB as a potential header
        if encounter_id not in _session_headers and len(audio_data) > 2048:
             _session_headers[encounter_id] = audio_data[:2048]
             
        audio_segment = audio_segment.set_frame_rate(sample_rate).set_channels(1).set_sample_width(2)
        return audio_segment.raw_data
    except Exception as e:
        # If decoding fails, try prepending the cached header
        if encounter_id in _session_headers:
            try:
                combined_data = _session_headers[encounter_id] + audio_data
                audio_segment = AudioSegment.from_file(io.BytesIO(combined_data))
                audio_segment = audio_segment.set_frame_rate(sample_rate).set_channels(1).set_sample_width(2)
                return audio_segment.raw_data
            except:
                pass
        
        logger.error(f"Decoding failed for {encounter_id}: {e}")
        return b""

def suppress_noise(audio_data: bytes, sample_rate: int = 16000) -> bytes:
    """
    Applies noise suppression to a raw PCM audio chunk.
    Input must be raw PCM 16-bit Mono.
    """
    try:
        # Convert bytes to numpy array
        if len(audio_data) == 0:
            return audio_data
            
        audio = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        
        if len(audio) == 0:
            return audio_data

        # 1. High-pass filter
        audio = highpass_filter(audio, 80, sample_rate)

        # 2. Simple Spectral Gating (more stable)
        max_abs = np.max(np.abs(audio))
        if max_abs < 100: # Silence threshold
             return b"\x00" * len(audio_data)
             
        threshold = 0.05 * max_abs
        mask = np.abs(audio) > threshold
        audio = audio * mask

        return audio.astype(np.int16).tobytes()
    except Exception as e:
        logger.error(f"Noise suppression error: {e}")
        return audio_data

def append_to_wav(file_path: str, pcm_data: bytes, sample_rate: int = 16000):
    """
    Efficiently appends raw PCM data to a WAV file without re-reading the whole file.
    """
    import os
    import wave
    
    if not pcm_data:
        return

    file_exists = os.path.exists(file_path)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    if not file_exists:
        with wave.open(file_path, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_data)
    else:
        # Fast append using standard file I/O and wave header update
        try:
            with open(file_path, "ab") as f:
                f.write(pcm_data)
            
            # Update WAV header (data size fields)
            file_size = os.path.getsize(file_path)
            with open(file_path, "rb+") as f:
                # RIFF header size: file_size - 8
                f.seek(4)
                f.write((file_size - 8).to_bytes(4, 'little'))
                # Data size: file_size - 44 (assuming standard 44-byte header)
                f.seek(40)
                f.write((file_size - 44).to_bytes(4, 'little'))
        except Exception as e:
            logger.error(f"Fast WAV append failed: {e}")
            # Fallback to slow but safe method if needed
