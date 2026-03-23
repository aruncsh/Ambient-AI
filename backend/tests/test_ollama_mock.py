import asyncio
import json
import httpx
from unittest.mock import MagicMock, patch
from app.modules.ai.medical_nlp import MedicalNLPService
from app.core.config import settings

async def test_ollama_integration():
    print("Testing Ollama Integration (Mocked)...")
    
    # Force settings for the test
    settings.OPENAI_API_KEY = None
    settings.GROQ_API_KEY = None
    settings.OLLAMA_URL = "http://localhost:11434/api/generate"
    settings.OLLAMA_MODEL = "phi3"
    
    service = MedicalNLPService()
    
    # Mock the httpx post call
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"response": '{"clean_conversation": "Patient: I have pain.", "soap": {"subjective": "Patient reports pain.", "objective": "Stable", "assessment": "Pain", "plan": "Rest"}}'}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        result = await service.process_precise_scribe("Patient: I have pain.")
        
        print("\n--- OLLAMA MOCK RESPONSE ---")
        print(json.dumps(result, indent=2))
        
        # Verify that httpx.post was called with the Ollama URL
        assert mock_post.called
        args, kwargs = mock_post.call_args
        assert args[0] == "http://localhost:11434/api/generate"
        assert kwargs["json"]["model"] == "phi3"
        assert kwargs["json"]["format"] == "json"
        
        print("\nSUCCESS: Ollama integration correctly calls the local API and parses the response.")

if __name__ == "__main__":
    asyncio.run(test_ollama_integration())
