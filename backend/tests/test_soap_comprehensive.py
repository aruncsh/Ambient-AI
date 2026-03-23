
import asyncio
import json
from app.modules.ai.medical_nlp import medical_nlp_service

async def verify_comprehensive_accuracy():
    print("Verifying Comprehensive SOAP Accuracy...")
    
    # Transcript 2 (More complex)
    transcript_2 = """
    Unknown: Good morning. What brings you in today?
    Unknown: I have been experiencing chest discomfort for the past three days along with fatigue and shortness of breath during exertion.
    Unknown: Can you describe the chest discomfort in detail?
    Unknown: It feels like a pressure sensation in the center of my chest, sometimes spreading to my left shoulder, and it becomes worse when I walk or climb stairs.
    Unknown: When did this start and how severe is it?
    Unknown: It started three days ago and has gradually increased in intensity. I would rate it as 7 out of 10 at its worst.
    Unknown: Do you have any associated symptoms like sweating, nausea, palpitations, or dizziness?
    Unknown: Yes, I feel occasional sweating and mild dizziness, but no vomiting.
    Unknown: Do you have cough, fever, or wheezing?
    Unknown: No, I do not have cough or fever.
    Unknown: Do you have any known medical conditions?
    Unknown: I have hypertension and type 2 diabetes for the past six years.
    Unknown: Are you taking medications regularly?
    Unknown: I take amlodipine for blood pressure and metformin for diabetes, but I sometimes miss doses.
    Unknown: Do you have any drug allergies?
    Unknown: No known drug allergies.
    Unknown: Is there any family history?
    Unknown: Yes, my father had a heart attack at the age of 54.
    Unknown: Do you smoke?
    Unknown: I smoke about 10 cigarettes per day.
    Unknown: Your vital signs are: temperature is 98.6, blood pressure is 148 over 92, heart rate is 104, respiratory rate is 22, and oxygen saturation is 95 percent.
    Unknown: Based on your symptoms, this is suggestive of stable angina or possible early acute coronary syndrome.
    Unknown: An electrocardiogram, cardiac enzyme tests, blood sugar levels, and lipid profile are required.
    Unknown: The treatment plan includes starting antiplatelet medication, statins, and adjusting medications.
    """
    
    print("\n--- Testing Transcript 2 ---")
    result = medical_nlp_service._rule_based_soap_extraction(transcript_2)
    print(json.dumps(result, indent=2))
    
    # Assertions for Transcript 2
    assert "BP: 148/92" in result["objective"]
    assert "RR: 22/min" in result["objective"]
    assert "discomfort" in [s.lower() for s in result["extracted_symptoms"]]
    assert "stable angina" in result["assessment"].lower() or "coronary syndrome" in result["assessment"].lower()
    
    # Check History
    history_lower = result["patient_history"].lower()
    assert "hypertension" in history_lower
    assert "diabetes" in history_lower
    assert "father" in history_lower or "heart attack" in history_lower
    assert "smoke" in history_lower or "cigarettes" in history_lower
    
    # Check Plan
    plan_lower = result["plan"].lower()
    assert "antiplatelet" in plan_lower or "statins" in plan_lower
    assert "electrocardiogram" in plan_lower or "cardiac enzyme" in plan_lower
    
    print("\nSUCCESS: Transcript 2 correctly parsed with expanded patterns.")

if __name__ == "__main__":
    asyncio.run(verify_comprehensive_accuracy())
