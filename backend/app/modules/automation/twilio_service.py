import logging

logger = logging.getLogger(__name__)

class TwilioService:
    async def send_notification(self, recipient: str, message: str, channel: str = "sms"):
        """
        Mock service for sending patient reminders via Twilio.
        """
        logger.info(f"MOCK {channel.upper()} SENT to {recipient}: {message}")
        return {
            "sid": "mock-sid-123456",
            "status": "sent",
            "channel": channel
        }

twilio_service = TwilioService()
