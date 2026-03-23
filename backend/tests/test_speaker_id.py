import asyncio
from app.modules.ai.fusion import ai_fusion
from app.modules.ai.medical_nlp import medical_nlp_service
from app.models.encounter import Encounter
from app.core.config import settings
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

async def test_speaker_id():
    # 1. Setup DB
    client = AsyncIOMotorClient(settings.MONGO_URL)
    await init_beanie(database=client.get_default_database(), document_models=[Encounter])
    
    # 2. Test Rule-Based Fallback (since LLM might not have key)
    print("--- Testing Rule-Based Speaker ID ---")
    mock_transcript = (
        "Speaker 1: Good morning sir, I have a headache.\n"
        "Speaker 1: How many days do you have a headache?\n"
        "Speaker 1: Four days sir."
    )
    
    # Simulate processing through generate_summary_from_text which uses rule-based if no LLM
    result = await ai_fusion.generate_summary_from_text(mock_transcript, patient_id="TestID")
    
    print("Processed Transcript:")
    # SOAPNote is a model, not a dict
    soap = result["soap_note"]
    raw_text = soap.raw_transcript if hasattr(soap, 'raw_transcript') else ""
    for t in raw_text.split('\n'):
        print(f"  {t}")
    
    # 3. Test LLM Prompt (if key available)
    if settings.OPENAI_API_KEY or settings.OLLAMA_URL:
        print("\n--- Testing LLM Speaker ID ---")
        try:
            chunk = "Speaker 1: How many days do you have a headache?"
            cleaned = await medical_nlp_service.clean_transcript_chunk("How many days do you have a headache?", "Speaker 1")
            print(f"Input: {chunk}")
            print(f"Cleaned Output: {cleaned}")
        except Exception as e:
            print(f"LLM test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_speaker_id())
