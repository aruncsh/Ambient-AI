from app.models.database import AsyncSessionLocal
from app.models.consent import Consent
from sqlalchemy.future import select

class ConsentManager:
    async def record_consent(self, encounter_id: int, patient_name: str, signature: bytes):
        async with AsyncSessionLocal() as session:
            consent = Consent(
                encounter_id=encounter_id,
                patient_name=patient_name,
                signature_blob=signature
            )
            session.add(consent)
            await session.commit()
            return consent

    async def verify_consent(self, encounter_id: int) -> bool:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Consent).where(Consent.encounter_id == encounter_id, Consent.is_revoked == False)
            )
            return result.scalar_one_or_none() is not None

consent_manager = ConsentManager()
