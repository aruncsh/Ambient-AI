
import asyncio
import json
from app.modules.ai.medical_nlp import medical_nlp_service

async def verify_soap_accuracy():
    print("Verifying SOAP Accuracy Fixes...")
    
    # The user's specific transcript that caused issues
    transcript = """
    Unknown: I have been having severe chest pain for the past 5 hours along with sweating and shortness of breath.
    Unknown: The pain feels like pressure in the center of the chest and radiates to the left arm.
    Unknown: I feel nauseous and slightly dizzy.
    Unknown: I have hypertension and diabetes for the past 6 years and take regular medication.
    Unknown: My father had a heart attack at 50 years of age.
    Unknown: I smoke one pack per day.
    Unknown: Vital signs show blood pressure 150 over 95, heart rate 108 beats per minute, respiratory rate 24, oxygen saturation 94 percent.
    Unknown: On examination, the patient appears anxious and sweating, with tachycardia and normal lung sounds.
    Unknown: The findings are suggestive of acute coronary syndrome.
    Unknown: Immediate treatment includes oxygen, aspirin, nitroglycerin, ECG, and cardiac enzyme testing.
    Unknown: Hospital admission is required and further cardiology evaluation is
    """
    
    print("\n--- Testing Rule-Based Fallback ---")
    # We test the rule-based extraction directly as it's the most likely path for local/fallback
    result = medical_nlp_service._rule_based_soap_extraction(transcript)
    
    print("\n--- RULE-BASED EXTRACTION RESULT ---")
    print(json.dumps(result, indent=2))
    
    # 1. Check for Temperature Hallucination
    # It should NOT be 50 F.
    assert "Temp: 50 F" not in result["objective"], "FAILED: Temperature hallucination '50 F' still present!"
    print("SUCCESS: No temperature hallucination from 'at 50'.")
    
    # 2. Check for Patient History
    # It should NOT be empty and should contain history elements
    assert "Hypertension" in result["patient_history"] or "hypertension" in result["patient_history"].lower(), "FAILED: Missing Hypertension in history"
    assert "Diabetes" in result["patient_history"] or "diabetes" in result["patient_history"].lower(), "FAILED: Missing Diabetes in history"
    assert "smoke" in result["patient_history"].lower() or "smoking" in result["patient_history"].lower() or "pack per day" in result["patient_history"].lower(), "FAILED: Missing Smoking history"
    print("SUCCESS: Patient history (Hypertension, Diabetes, Smoking) correctly extracted.")
    
    # 3. Check for Subjective Cleanup
    assert "Unknown:" not in result["subjective"], "FAILED: 'Unknown:' prefix still present in subjective"
    print("SUCCESS: 'Unknown:' prefixes removed from subjective.")
    
    # 4. Check for Vitals
    assert "BP: 150/95" in result["objective"], "FAILED: Missing BP"
    assert "SpO2: 94%" in result["objective"], "FAILED: Missing SpO2"
    assert "HR: 108 bpm" in result["objective"], "FAILED: Missing HR"
    assert "RR: 24/min" in result["objective"], "FAILED: Missing RR"
    print("SUCCESS: Vitals correctly extracted.")
    
    # 5. Check for Assessment
    assert "acute coronary syndrome" in result["assessment"].lower(), f"FAILED: Missing Acute coronary syndrome in assessment, got: {result['assessment']}"
    print("SUCCESS: Diagnosis correctly extracted into Assessment.")

    print("\n--- Verification Complete: ALL TESTS PASSED ---")

if __name__ == "__main__":
    asyncio.run(verify_soap_accuracy())
