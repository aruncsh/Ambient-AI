import asyncio
import httpx
import json

async def test_precise_scribe():
    # Attempt to connect to the existing backend
    base_url = "http://127.0.0.1:8001/api/v1"
    
    # Sample noisy, Tanglish transcript
    input_text = """
    Doctor: Okay, so... uh... hello Mr. Kumar. Hmm. Eppadi irukkeenga? How are you feeling today?
    Patient: Uh... doctor... konjam cold and cough irukku. I have some... um... body pain also.
    Doctor: I see. Okay. Body pain and cough. Hmm. Any fever? Kaachal irukka?
    Patient: Yes, morning... uh... 101 degrees irundhuchu. 
    Doctor: Okay. 101 fever. Any breathing difficulty?
    Patient: No... but... uh... tired-ah irukku. Very tired. 
    Doctor: Hmm. Okay. I will prescribe some paracetamol and... uh... cough syrup. 
    Patient: Okay doctor.
    """
    
    print("Testing Precise Scribe Endpoint...")
    print(f"Input: {input_text[:100]}...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            res = await client.post(f"{base_url}/summary/precise-scribe", json={"input_text": input_text})
            
            if res.status_code != 200:
                print(f"FAILED: Status code {res.status_code}")
                print(f"Response: {res.text}")
                return

            result = res.json()
            print("\n--- RESPONSE ---")
            print(json.dumps(result, indent=2))
            
            # Validation
            assert "clean_conversation" in result
            assert "soap" in result
            assert all(k in result["soap"] for k in ["subjective", "objective", "assessment", "plan"])
            
            print("\nSUCCESS: Output is valid JSON and contains all required fields.")
            
            if result["clean_conversation"]:
                print(f"Clean Conversation Sample: {result['clean_conversation'][:100]}...")
            
        except Exception as e:
            print(f"ERROR: Could not connect to backend at {base_url}. Is it running?")
            print(f"Details: {e}")

if __name__ == "__main__":
    asyncio.run(test_precise_scribe())
