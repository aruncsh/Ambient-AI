
import asyncio
import os
import sys

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

async def test_extraction():
    from app.modules.ai.medical_nlp import medical_nlp_service
    
    transcript = """Doctor: Good morning, Mr. Kumar. Nice to see you again. Please have a seat. How have you been since your last visit four weeks ago?
Patient: Good morning, Doctor. Honestly, not great. The headaches I told you about last time have become more frequent — almost every evening now. I feel very tired by afternoon, and sometimes I get a little short of breath when I walk up the stairs at home. My wife is also worried.
Doctor: I’m sorry to hear that. Let’s go step by step. First, tell me more about these headaches. When did they start getting worse? Any nausea, vomiting, blurred vision, or dizziness with them?
Patient: They started becoming daily about ten days ago. No vomiting, but sometimes I see black spots for a few seconds. No dizziness.
Doctor: Understood. Now, let’s quickly review your full history so I have everything clear.
You were diagnosed with Type-2 Diabetes five years ago. You’re on Metformin 500 mg twice daily and Glimepiride 2 mg once daily. Blood pressure was high last time — 148/92 — so we started Amlodipine 5 mg. Any chest pain, palpitations, swelling in feet, or changes in urination? Any family history of heart disease, stroke, or kidney problems?
Patient: No chest pain, but yes, my father had a heart attack at 62. My mother has high BP and diabetes. No swelling in feet, but I wake up twice at night to urinate. I still smoke 4–5 cigarettes a day, though I reduced it.
Doctor: Thank you for being honest about the smoking. Any allergies to medicines? Any other past surgeries or hospitalizations?
Patient: No allergies. I had an appendix operation 15 years ago, nothing else.
Doctor: Perfect. Nurse has just checked your vitals. Let me share them with you:
Blood Pressure: 152/96 mmHg (right arm, sitting)
Pulse: 88 beats per minute, regular
Temperature: 98.4 °F
Respiratory rate: 18 breaths per minute
Oxygen saturation: 96% on room air
Weight: 82 kg (BMI 28.4 — still in overweight range)
Random blood sugar today: 178 mg/dL
These numbers are higher than last month’s 142/88. That explains the headaches and tiredness.
Doctor: (continues while doing quick exam) Let me listen to your chest and check your eyes and legs.
… (after 2 minutes) Heart sounds are normal, no extra murmurs. Lungs clear. No swelling in legs. Eyes show mild retinal changes consistent with long-standing diabetes and hypertension.
So, putting it all together — my assessment today:
Your blood pressure is not well controlled despite the medicine. The headaches and shortness of breath are likely from uncontrolled hypertension plus possible early diabetic complications. Your diabetes is also above target (HbA1c was 8.2% last time). No emergency signs right now, but we cannot ignore this.
Patient: Doctor, is it serious? Should I worry?
Doctor: It’s manageable, but we need to act now so it doesn’t become serious. Here’s the plan we will follow:
Medicine change — I’m increasing Amlodipine to 10 mg once daily at night. Continue your diabetes tablets for now. I’ll give you a new prescription.
Tests — We need fresh blood work: HbA1c, lipid profile, kidney function (urea, creatinine, eGFR), and urine albumin. I’ll write the lab slip.
Referral — Because of the eye changes and family history of heart disease, I’m referring you to a Cardiologist (Dr. Mehta at City Heart Hospital) and an Ophthalmologist for detailed retina check. I’ll send the referral letter with you today.
Lifestyle — Strictly reduce salt, no smoking at all (I can prescribe nicotine replacement if needed), 30 minutes brisk walking daily, and low-carb diet for diabetes.
Follow-up date — Come back to me in exactly 3 weeks — that’s 20th April 2026 at 10:00 AM. We’ll repeat BP and review the lab reports and specialist opinions. If anything worsens before that (severe headache, chest pain, breathlessness at rest), go straight to emergency and call me.
Patient: Okay, Doctor. I’ll follow everything. Can you please repeat the follow-up date and the specialists’ names?
Doctor: Sure. Follow-up here on 20th April 2026, 10 AM. Referral to Dr. Mehta (Cardiologist) and Ophthalmologist. I’ll give you printed instructions and the referral letter right now.
Patient: Thank you so much, Doctor. I feel much clearer now.
Doctor: You’re welcome, Mr. Kumar. Take care. See you on 20th April. Any last questions?
Patient: No, I’m good.
Doctor: Great. Safe journey home."""

    print("Testing Vitals Extraction...")
    vitals = await medical_nlp_service.extract_vitals_from_text(transcript)
    print(f"Vitals: {vitals}")
    
    print("\nTesting ICD-10 Lookup threshold/noise...")
    from app.modules.ai.icd10_lookup import icd10_service
    diag = "From uncontrolled hypertension plus possible early diabetic complications"
    matches = icd10_service.lookup(diag)
    print(f"Matches for '{diag}': {matches}")

if __name__ == "__main__":
    asyncio.run(test_extraction())
