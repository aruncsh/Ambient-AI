
import asyncio
import json
from app.modules.ai.medical_nlp import medical_nlp_service

async def test_speaker_attribution():
    print("Testing Speaker Attribution Improvements...")
    
    transcript = "Speaker 1: Good morning. Do you have a fever?\nSpeaker 1: No. Just headache.\nSpeaker 1: Okay. Take this medicine after me. You'll be fine soon. Good morning."
    
    print("\n--- INPUT TRANSCRIPT ---")
    print(transcript)
    
    result = medical_nlp_service._rule_based_soap_extraction(transcript)
    clean_transcript = result.get("clean_transcript", "")
    
    print("\n--- CLEANED TRANSCRIPT ---")
    print(clean_transcript)
    
    lines = clean_transcript.split('\n')
    
    # Expected:
    # 1. Doctor: Good morning. Do you have a fever?
    # 2. Patient: No. Just headache.
    # 3. Doctor: Okay. Take this medicine after me. You'll be fine soon. Good morning.
    
    all_passed = True
    
    if "Doctor:" not in lines[0]:
        print(f"FAILED: Line 1 should be Doctor, got: {lines[0]}")
        all_passed = False
    else:
        print("SUCCESS: Line 1 attributed to Doctor.")
        
    if "Patient:" not in lines[1]:
        print(f"FAILED: Line 2 should be Patient, got: {lines[1]}")
        all_passed = False
    else:
        print("SUCCESS: Line 2 attributed to Patient.")
        
    if "Doctor:" not in lines[2]:
        print(f"FAILED: Line 3 should be Doctor, got: {lines[2]}")
        all_passed = False
    else:
        print("SUCCESS: Line 3 attributed to Doctor.")

    if "Speaker 1" in clean_transcript:
        print("FAILED: 'Speaker 1' still present in cleaned transcript.")
        all_passed = False
    else:
        print("SUCCESS: No 'Speaker 1' labels in cleaned transcript.")

    if all_passed:
        print("\n--- SPEAKER ATTRIBUTION TESTS PASSED ---")
    else:
        print("\n--- SOME TESTS FAILED ---")
        exit(1)

if __name__ == "__main__":
    asyncio.run(test_speaker_attribution())
