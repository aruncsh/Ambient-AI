import wave
import numpy as np
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from backend.app.modules.ai.whisper import whisper_service

async def test_with_valid_wav():
    print("--- Testing with valid WAV file ---")
    
    # 1. Generate 3 seconds of silence (valid WAV)
    sample_rate = 16000
    duration = 3
    num_samples = sample_rate * duration
    silence = np.zeros(num_samples, dtype=np.int16)
    
    wav_path = "test_silence.wav"
    with wave.open(wav_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(silence.tobytes())
    
    with open(wav_path, "rb") as f:
        audio_data = f.read()
    
    print(f"File generated: {wav_path} ({len(audio_data)} bytes)")
    
    try:
        text = await whisper_service.transcribe(audio_data, provider="local")
        print(f"Result: '{text}'")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == "__main__":
    asyncio.run(test_with_valid_wav())
