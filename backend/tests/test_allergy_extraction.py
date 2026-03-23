
import asyncio
import json
from app.modules.ai.medical_nlp import medical_nlp_service

async def test_allergy_extraction():
    print("Testing Allergy Extraction Improvements...")
    
    test_cases = [
        {
            "name": "Seafood Allergy",
            "transcript": "Speaker 1: When I eat seafoods, I face skin allergies.",
            "expected_symptoms": ["Allergy"], # Based on the regex, will find 'Allergies' which contains 'allerg'
            "expected_allergies": ["seafoods"]
        },
        {
            "name": "Penicillin Allergy",
            "transcript": "Patient: I am allergic to penicillin and it causes hives.",
            "expected_symptoms": ["Allergic", "Hives"],
            "expected_allergies": ["penicillin"]
        },
        {
            "name": "Soap Reaction",
            "transcript": "Unknown: I get a rash whenever I use this soap.",
            "expected_symptoms": ["Rash"],
            "expected_allergies": ["soap"]
        }
    ]
    
    all_passed = True
    
    for case in test_cases:
        print(f"\n--- Testing Case: {case['name']} ---")
        result = medical_nlp_service._rule_based_soap_extraction(case['transcript'])
        
        # Verify symptoms (case-insensitive check)
        result_symptoms_str = " ".join(result['subjective']['symptoms']).lower()
        for expected in case['expected_symptoms']:
            # Handle allergy vs allergies
            search_term = expected.lower()
            if search_term == "allergy":
                found = "allerg" in result_symptoms_str
            else:
                found = search_term in result_symptoms_str
                
            if not found:
                print(f"FAILED: Missing symptom '{expected}' in {result['subjective']['symptoms']}")
                all_passed = False
            else:
                print(f"SUCCESS: Found symptom '{expected}'")

        # Verify allergies
        result_allergies_str = " ".join(result['patient_history']['allergies']).lower()
        for expected in case['expected_allergies']:
            if expected.lower() not in result_allergies_str:
                print(f"FAILED: Missing allergy '{expected}' in {result['patient_history']['allergies']}")
                all_passed = False
            else:
                print(f"SUCCESS: Found allergy '{expected}'")
                
        # Verify Assessment
        if "Allergic reaction" not in result['assessment']['primary_diagnosis']:
             print(f"FAILED: Primary diagnosis not 'Allergic reaction', got: {result['assessment']['primary_diagnosis']}")
             all_passed = False
        if not all_passed:
            print(f"DEBUG: Full result for {case['name']}:")
            print(json.dumps(result, indent=2))
            
    if all_passed:
        print("\n--- ALL ALLERGY EXTRACTION TESTS PASSED ---")
    else:
        print("\n--- SOME TESTS FAILED ---")
        exit(1)

if __name__ == "__main__":
    asyncio.run(test_allergy_extraction())
