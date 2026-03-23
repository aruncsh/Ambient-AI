import asyncio
import random

class IoTStreamer:
    async def stream_vitals(self, callback):
        """Simulates real-time IoT vital sign data."""
        while True:
            vitals = {
                "heart_rate": random.randint(60, 100),
                "spO2": random.randint(95, 100),
                "bp_systolic": random.randint(110, 140),
                "bp_diastolic": random.randint(70, 90)
            }
            await callback(vitals)
            await asyncio.sleep(2)

iot_streamer = IoTStreamer()
