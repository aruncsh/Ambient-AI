import wave
import numpy as np
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.modules.ai.whisper import whisper_service

async def test_tamil_phonetic():
    print("--- Testing with Phonetic Tamil (Mock Audio) ---")
    
    # We can't easily generate 'kathu valiku' audio, but we can verify the model behavior 
    # with a real audio file if we had one. 
    # For now, let's just make sure the service doesn't crash with the new prompt.
    
    sample_rate = 16000
    duration = 2
    num_samples = sample_rate * duration
    audio = (np.random.normal(0, 500, num_samples)).astype(np.int16).tobytes()
    
    import io
    
    # Create a valid mono 16bit 16kHz WAV in memory
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio)
    
    audio_wav = buf.getvalue()
    
    try:
        text = await whisper_service.transcribe(audio_wav, provider="local")
        print(f"Result: '{text}'")
        print("Note: Random noise will likely return empty/filtered text, which is good.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_tamil_phonetic())
