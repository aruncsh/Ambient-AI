
import sys
import os

# Set Python path to include backend
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.models.encounter import SOAPNote

def test_soap_note_types():
    note = SOAPNote()
    print(f"Subjective type: {type(note.subjective)}")
    print(f"Subjective value: {note.subjective}")
    
    if isinstance(note.subjective, dict):
        print("VERIFICATION SUCCESS: subjective is a dictionary.")
    elif isinstance(note.subjective, tuple):
        print("VERIFICATION FAILURE: subjective is still a tuple.")
    else:
        print(f"VERIFICATION FAILURE: subjective is of unexpected type {type(note.subjective)}.")

if __name__ == "__main__":
    test_soap_note_types()
