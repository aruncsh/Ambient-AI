import logging
import aiohttp
from app.core.config import settings

logger = logging.getLogger(__name__)

class TwilioService:
    async def send_notification(self, recipient: str, message: str, channel: str = "sms"):
        """
        Sends patient reminders via Twilio API.
        """
        if not settings.TWILIO_SID or not settings.TWILIO_TOKEN or not settings.TWILIO_NUMBER:
            logger.warning(f"Twilio credentials missing. Skipping {channel.upper()} to {recipient}: {message}")
            return {
                "sid": None,
                "status": "failed",
                "error": "Missing credentials"
            }

        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_SID}/Messages.json"
        auth = aiohttp.BasicAuth(settings.TWILIO_SID, settings.TWILIO_TOKEN)
        
        data = {
            "To": recipient,
            "From": settings.TWILIO_NUMBER,
            "Body": message
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=data, auth=auth) as response:
                    if response.status in [200, 201]:
                        result = await response.json()
                        logger.info(f"Twilio {channel.upper()} SENT to {recipient}: {result.get('sid')}")
                        return {
                            "sid": result.get("sid"),
                            "status": "sent",
                            "channel": channel
                        }
                    else:
                        error_data = await response.text()
                        logger.error(f"Twilio API error ({response.status}): {error_data}")
                        return {
                            "status": "failed",
                            "error": f"HTTP {response.status}"
                        }
        except Exception as e:
            logger.error(f"Twilio service exception: {e}")
            return {"status": "error", "error": str(e)}

twilio_service = TwilioService()

