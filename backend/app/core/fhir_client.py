import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class FHIRClient:
    def __init__(self):
        self.base_url = settings.FHIR_URL

    async def post_resource(self, resource_type: str, data: dict):
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.base_url}/{resource_type}", json=data)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"FHIR Error: {str(e)}")
                raise e

fhir_client = FHIRClient()
