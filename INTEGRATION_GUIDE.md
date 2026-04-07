# Ambient AI: External Integration Guide

This guide describes how to integrate the **Voice-to-SOAP** clinical documentation feature into your own backend or application.

## 1. Backend Base URL
Your current backend is running on:
`http://localhost:8001/api/v1`

> [!NOTE]
> Replace `localhost` with your server's public IP address or domain when sharing this with others.

---

## 2. API Endpoints

### A. Voice-to-SOAP (Direct Audio)
Send an audio file directly to get a structured SOAP note.

- **URL:** `/ai/voice-to-soap`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Body Params:**
    - `file`: The audio file (mp3, wav, m4a, webm).
    - `specialty` (optional): Specialty focus (e.g., "Cardiology", "Pediatrics").

#### Example (cURL):
```bash
curl -X POST "http://localhost:8001/api/v1/ai/voice-to-soap" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@recording.wav" \
     -F "specialty=Cardiology"
```

---

### B. Text-to-SOAP (Conversation Text)
If they already have a transcript, they can send the raw text to generate a SOAP note.

- **URL:** `/ai/text-to-soap`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Body Params:**
    - `text`: The full conversation text.
    - `specialty` (optional): Specialty focus.

#### Example (Python):
```python
import requests

url = "http://localhost:8001/api/v1/ai/text-to-soap"
data = {
    "text": "Doctor: How are you? Patient: I have a cough and fever since yesterday.",
    "specialty": "General Medicine"
}

response = requests.post(url, json=data)
print(response.json())
```

---

## 3. Response Format
Both endpoints return a structured JSON response with the following main sections:

```json
{
  "soap": {
      "subjective": {
          "chief_complaint": "Persistent cough and fever",
          "history_of_present_illness": "Patient reports onset since yesterday...",
          "symptoms": ["cough", "fever"]
      },
      "objective": {
          "vitals": { "temperature": "101 F" },
          "physical_examination": { "general_appearance": "Fatigued" }
      },
      "assessment": {
          "primary_diagnosis": "Upper Respiratory Infection",
          "icd10_code": "J06.0"
      },
      "plan": {
          "medications": ["Paracetamol 500mg as needed"],
          "diagnostic_tests": ["Covid-19 rapid test"]
      }
  },
  "insights": {
      "problem": "Acute viral respiratory symptoms",
      "symptoms": ["cough", "fever"],
      "diagnoses": [{"name": "URI", "icd10": "J06.0"}]
  }
}
```

---

## 4. Troubleshooting
- **CORS:** The backend is configured to allow all origins (`*`) by default.
- **Port:** Ensure port `8001` is open on your firewall.
- **Model Warmup:** The first request might take slightly longer as the AI models (Whisper/LLM) warm up.
