import asyncio
import os
import sys
import numpy as np

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from backend.app.modules.ai.whisper import whisper_service
from backend.app.modules.ai.diarization import diarization_service

async def verify():
    print("--- Verifying AI Modules (Stable Version) ---")
    
    # 1. Create dummy audio chunk (simulate speech)
    # 16kHz, 1 second of random noise (simulating audio energy)
    dummy_audio = (np.random.normal(0, 1000, 16000)).astype(np.int16).tobytes()
    
    print("1. Testing Faster-Whisper...")
    try:
        text = await whisper_service.transcribe(dummy_audio, provider="local")
        print(f"   Whisper Output: '{text}'")
        print("   ✅ Faster-Whisper verified")
    except Exception as e:
        print(f"   ❌ Faster-Whisper failed: {e}")

    print("\n2. Testing Custom Diarization...")
    try:
        speaker_id = await diarization_service.get_speaker_id(dummy_audio)
        print(f"   Diarization Output: '{speaker_id}'")
        print("   ✅ Diarization verified")
    except Exception as e:
        print(f"   ❌ Diarization failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
