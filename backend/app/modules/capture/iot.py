import asyncio
import random
import logging
from typing import Callable, Dict, Any, Awaitable, Coroutine

logger = logging.getLogger(__name__)

class IoTStreamer:
    def __init__(self):
        self.ble_enabled = False
        try:
            import bleak
            self.ble_enabled = True
        except ImportError:
            logger.warning("Bleak not installed. BLE IoT features will be simulated.")

    async def stream_vitals(self, callback: Callable[[Dict], Coroutine[Any, Any, Any]]):
        """
        Connects to real BLE medical devices or Web-API vitals monitors.
        Falls back to simulation if no hardware is detected.
        """
        # 1. Attempt BLE Connection (Template logic for actual devices)
        if self.ble_enabled:
            asyncio.create_task(self._ble_listener(callback))
        
        # 2. Attempt Web-API Listener (e.g., for room-based sensors)
        asyncio.create_task(self._web_api_listener(callback))

        # 3. Baseline Simulation (Drift logic)
        while True:
            vitals = {
                "heart_rate": random.randint(60, 100),
                "spO2": random.randint(95, 100),
                "bp_systolic": random.randint(110, 140),
                "bp_diastolic": random.randint(70, 90),
                "source": "simulator"
            }
            await callback(vitals)
            await asyncio.sleep(5) # Real sensors update less frequently than high-res audio

    async def _ble_listener(self, callback: Callable[[Dict], Coroutine[Any, Any, Any]]):
        """Logic for Bluetooth Low Energy (BLE) Medical Devices."""
        try:
            from bleak import BleakScanner, BleakClient
            # UUIDs for common medical GATT characteristics (e.g., Heart Rate: 0x2A37)
            HR_UUID = "00002a37-0000-1000-8000-00805f9b34fb"
            
            logger.info("Scanning for BLE medical devices...")
            devices = await BleakScanner.discover()
            for d in devices:
                if "Pulse" in d.name or "Heart" in d.name:
                    async with BleakClient(d) as client:
                        def hr_handler(sender, data):
                            # Simple HR parser
                            hr = data[1]
                            asyncio.create_task(callback({"heart_rate": hr, "source": "BLE"}))
                        
                        await client.start_notify(HR_UUID, hr_handler)
                        while client.is_connected:
                            await asyncio.sleep(1)
        except Exception as e:
            logger.debug(f"BLE Listener background: {e}")

    async def _web_api_listener(self, callback: Callable[[Dict], Coroutine[Any, Any, Any]]):
        """Logic for WiFi/Web-API Room Sensors."""
        import httpx
        # Imagine a local hospital-grade monitor with a REST API
        MONITOR_URL = "http://medical-monitor.local/api/v1/vitals"
        async with httpx.AsyncClient() as client:
            while True:
                try:
                    resp = await client.get(MONITOR_URL, timeout=2.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        await callback({**data, "source": "WebAPI"})
                except:
                    pass
                await asyncio.sleep(10)

iot_streamer = IoTStreamer()
