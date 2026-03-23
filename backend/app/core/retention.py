import asyncio
from datetime import datetime, timedelta
import logging
from app.models.encounter import Encounter

logger = logging.getLogger(__name__)

async def retention_worker():
    """Background task to delete old raw media metadata or mark for deletion."""
    while True:
        try:
            logger.info("Running 24h retention policy check...")
            now = datetime.utcnow()
            cutoff = now - timedelta(hours=24)
            
            # Find encounters older than 24h that haven't been processed for deletion
            # In a real app, this would delete files from S3/Disk
            encounters_to_scrub = await Encounter.find(
                Encounter.created_at < cutoff,
                Encounter.status != "scrubbed"
            ).to_list()
            
            for encounter in encounters_to_scrub:
                logger.info(f"Scrubbing raw data for encounter: {encounter.id}")
                # Mock scrubbing: Clear URLs of raw media
                encounter.consent_audio_url = "[DELETED_BY_RETENTION_POLICY]"
                # encounter.raw_audio_path = None 
                encounter.status = "scrubbed"
                await encounter.save()
                
            await asyncio.sleep(3600) # Run every hour
        except Exception as e:
            logger.error(f"Retention worker error: {e}")
            await asyncio.sleep(60)
