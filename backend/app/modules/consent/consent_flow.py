import os
import base64
import uuid
from datetime import datetime
from app.models.encounter import Encounter
from beanie import PydanticObjectId

class ConsentFlow:
    async def record_consent(self, encounter_id: str, type: str, data: str):
        """
        Records patient consent (signature or verbal).
        - type: 'signature' or 'verbal'
        - data: base64 encoded png (signature) or base64 encoded audio (verbal)
        """
        encounter = await Encounter.get(PydanticObjectId(encounter_id))
        if not encounter:
            return {"success": False, "error": "Encounter not found"}

        consent_dir = os.path.join(os.getcwd(), "recordings", "consent")
        os.makedirs(consent_dir, exist_ok=True)
        
        file_id = f"{encounter_id}_{uuid.uuid4().hex[:8]}"
        
        if type == "signature":
            file_path = os.path.join(consent_dir, f"{file_id}.png")
            # data is 'data:image/png;base64,...'
            header, encoded = data.split(",", 1) if "," in data else ("", data)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(encoded))
            
            encounter.consent_signature_url = file_path
            encounter.consent_obtained = True
            
        elif type == "verbal":
            file_path = os.path.join(consent_dir, f"{file_id}.wav")
            # data is base64 encoded audio
            header, encoded = data.split(",", 1) if "," in data else ("", data)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(encoded))
            
            encounter.consent_audio_url = file_path
            encounter.consent_obtained = True
        
        await encounter.save()
        return {
            "success": True, 
            "consent_obtained": True,
            "signature_url": encounter.consent_signature_url,
            "audio_url": encounter.consent_audio_url
        }

consent_flow = ConsentFlow()
