import asyncio
import random

class IoTSimulator:
    async def stream_vitals(self, callback):
        """Simulates real-time vital sign data from sensors."""
        while True:
            vitals = {
                "hr": random.randint(60, 100),
                "bp": f"{random.randint(110, 140)}/{random.randint(70, 90)}",
                "spo2": random.randint(95, 100),
                "temp": round(random.uniform(36.5, 37.5), 1)
            }
            await callback(vitals)
            await asyncio.sleep(2) # Stream every 2 seconds

iot_simulator = IoTSimulator()
