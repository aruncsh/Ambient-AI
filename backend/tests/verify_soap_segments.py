import asyncio
import httpx
import json

async def verify_soap_segments():
    base_url = "http://127.0.0.1:8001/api/v1"
    
    # Long transcript with lots of filler and doctor talk
    input_text = """
    Doctor: Good morning. How are you today?
    Patient: I'm okay, but I have a bad headache since yesterday.
    Doctor: I see. Where does it hurt exactly?
    Patient: It's mostly on the right side.
    Doctor: Okay. Any nausea or vision changes?
    Patient: A little bit of nausea, no vision changes.
    Doctor: I'll check your blood pressure now. Hmm, it's 140 over 90. That's a bit high.
    Patient: Oh, I see.
    Doctor: I'll prescribe some Ibuprofen for the headache and we should monitor your BP.
    Patient: Thank you, doctor.
    """
    
    print("Verifying SOAP Segments...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # We use the precise-scribe endpoint directly to test the NLP logic
            res = await client.post(f"{base_url}/summary/precise-scribe", json={"input_text": input_text})
            
            if res.status_code != 200:
                print(f"FAILED: Status code {res.status_code}")
                return

            result = res.json()
            soap = result.get("soap", {})
            subjective = soap.get("subjective", "")
            
            print("\n--- SUBJECTIVE SECTION ---")
            print(subjective)
            
            # Validation: Subjective should NOT contain "Doctor:" or the full conversation
            assert "Doctor:" not in subjective, "Subjective contains 'Doctor:' labels"
            assert len(subjective) < len(input_text) * 0.5, "Subjective section is too long (likely a transcript dump)"
            assert "headache" in subjective.lower(), "Subjective missed the core symptom"
            
            print("\nSUCCESS: Subjective section is concise and clinically relevant.")
            
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(verify_soap_segments())
