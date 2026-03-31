import re

transcript = """Doctor: Blood Pressure is 172 over 108 mmHg. Pulse is 108 beats per minute. Respiratory rate is 26 breaths per minute. Oxygen saturation is 90 percent on room air. Random blood sugar is 256 mg/dL. You are 72 years old with Type-2 Diabetes, Hypertension, Chronic Kidney Disease stage 4, Coronary Artery Disease, Congestive Heart Failure. I am starting Dapagliflozin 10 mg once daily. Add Finerenone 10 mg daily. Increase Furosemide to 80 mg twice daily. We need HbA1c, chest X-ray, and ECG today. Referring you to Cardiologist Dr. Mehta and Nephrologist Dr. Singh. Follow-up on 5th April 2026 at 9 AM. If breathlessness worsens go straight to emergency.
Patient: I have severe shortness of breath, chest pain, swollen legs, and extreme weakness."""

vital_patterns = {
    'blood_pressure': [
        r'blood pressure[^\d]*(\d{2,3})\s*(?:over|/|-)\s*(\d{2,3})',
        r'\bbp[^\d]*(\d{2,3})\s*(?:over|/|-)\s*(\d{2,3})',
    ],
    'heart_rate': [r'(?:pulse|heart rate|hr)[^\d]*(\d{2,3})\s*(?:beats? per minute|bpm|/min)?'],
    'respiratory_rate': [r'(?:respiratory rate|respiration)[^\d]*(\d{1,3})\s*(?:breaths?|/min)?'],
    'oxygen_saturation': [r'(?:oxygen saturation|spo\s*2|o2\s*sat(?:uration)?|saturation)[^\d]*(\d{2,3})\s*%?'],
    'blood_sugar': [r'(?:random blood sugar|blood sugar|glucose|rbs|fbs)[^\d]*(\d{2,4})\s*(?:mg[/.]?dl|mg%|mmol)?'],
}

vitals = {}
tl = transcript.lower()
for vkey, pats in vital_patterns.items():
    for pat in pats:
        m = re.search(pat, tl)
        if m:
            if vkey == 'blood_pressure':
                vitals[vkey] = f'{m.group(1)}/{m.group(2)} mmHg'
            elif vkey == 'heart_rate':
                vitals[vkey] = f'{m.group(1)} bpm'
            elif vkey == 'respiratory_rate':
                vitals[vkey] = f'{m.group(1)}/min'
            elif vkey == 'oxygen_saturation':
                vitals[vkey] = f'{m.group(1)}%'
            elif vkey == 'blood_sugar':
                vitals[vkey] = f'{m.group(1)} mg/dL'
            break

print('=== VITALS ===')
for k, v in vitals.items():
    print(f'  {k}: {v}')

KNOWN_MEDS = ['metformin','dapagliflozin','finerenone','furosemide','carvedilol','aspirin',
              'atorvastatin','spironolactone','salbutamol','budesonide','pantoprazole',
              'amlodipine','telmisartan','insulin','glimepiride']
medications = []
for line in transcript.split('\n'):
    content = re.sub(r'^(?:Doctor|Patient):\s*', '', line, flags=re.I).strip().lower()
    for med in KNOWN_MEDS:
        if med in content:
            med_pat = rf'{re.escape(med)}[\s,]*(\d+\s*(?:mg|mcg|units?|ml|g))?[\s,]*((?:once|twice|three times?|\d+\s*times?)\s*(?:daily|a day|at night|in the morning|per day|weekly))?'
            mm = re.search(med_pat, content)
            if mm:
                dose = (mm.group(1) or '').strip()
                freq = (mm.group(2) or '').strip()
                label = med.title()
                if dose: label += f' {dose}'
                if freq: label += f' {freq}'
                if label not in medications:
                    medications.append(label)
print('\n=== MEDICATIONS ===')
for m in medications:
    print(f'  {m}')

test_keywords = {
    'HbA1c': ['hba1c', 'glycated hemoglobin'],
    'Chest X-ray': ['chest x-ray', 'chest xray', 'x-ray'],
    'ECG': ['ecg', 'electrocardiogram', 'ekg'],
    'Kidney Function / Electrolytes': ['kidney function', 'renal function', 'electrolytes', 'creatinine', 'egfr'],
    'BNP': ['bnp'],
    'Lipid Profile': ['lipid profile'],
}
diagnostic_tests = []
for test_name, keywords in test_keywords.items():
    if any(kw in tl for kw in keywords):
        diagnostic_tests.append(test_name)
print('\n=== DIAGNOSTIC TESTS ===')
for t in diagnostic_tests:
    print(f'  {t}')

date_pattern = r'(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)'
follow_up_found = None
for line in transcript.split('\n'):
    dm = re.search(date_pattern, line, re.I)
    if dm:
        cand = dm.group(1).strip()
        cl = line.lower()
        if any(k in cl for k in ['come back', 'follow', 'return', 'see you', 'april', 'may', 'june']):
            follow_up_found = cand
print(f'\n=== FOLLOW-UP: {follow_up_found} ===')

ref_pattern = r'referring(?:\s+you)?\s+(?:urgently\s+)?to\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,3}(?:\s+Dr\.\s+[A-Za-z]+)?)'
doc_ref_pattern = r'((?:Cardiologist|Nephrologist|Pulmonologist|Endocrinologist|Neurologist)(?:\s+Dr\.\s+[A-Za-z]+)?)'
refs = []
for line in transcript.split('\n'):
    for m in re.finditer(ref_pattern, line, re.I):
        rt = m.group(1).strip().rstrip('.,')
        if rt and rt not in refs:
            refs.append(rt)
    for m in re.finditer(doc_ref_pattern, line, re.I):
        rt = m.group(1).strip()
        if rt and rt not in refs:
            refs.append(rt)
print(f'\n=== REFERRALS: {refs} ===')

KNOWN_CONDITIONS = [
    'type-2 diabetes', 'type 2 diabetes', 'diabetes', 'hypertension',
    'chronic kidney disease', 'coronary artery disease', 'congestive heart failure',
    'heart failure', 'copd', 'asthma', 'atrial fibrillation',
]
pmh_triggers = [
    r'you (?:are|have)(?: a)? (?:72|\d+) years old with (.+?)(?:\.|$)',
]
pmh = []
for line in transcript.split('\n'):
    cl = line.lower()
    if 'doctor:' in cl or 'history' in cl or 'years old' in cl:
        for pat in pmh_triggers:
            m = re.search(pat, cl, re.I)
            if m:
                for cond in re.split(r',\s*|\s+and\s+', m.group(1)):
                    cond = cond.strip().rstrip('.')
                    if len(cond) > 3:
                        pmh.append(cond.title())
        for cond in KNOWN_CONDITIONS:
            if cond in cl and cond.title() not in pmh:
                pmh.append(cond.title())
print(f'\n=== PMH: {pmh} ===')

warn_signs = []
warn_triggers = [
    r'(?:if|when)\s+(.{5,60}?)\s+(?:worsens?|increases?|go to emergency|seek|call me|inform me)',
]
for line in transcript.split('\n'):
    if 'doctor:' in line.lower():
        for wp in warn_triggers:
            for m in re.finditer(wp, line, re.I):
                s = (m.group(1) or '').strip().capitalize()
                if s and s not in warn_signs and len(s) > 3:
                    warn_signs.append(s)
print(f'\n=== WARNING SIGNS: {warn_signs} ===')
