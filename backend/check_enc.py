import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def check():
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client.ambient_ai
    enc = await db.encounters.find_one({"_id": ObjectId("69cf8ecbf27ab0eeee182abe")})
    print(f"Found: {enc is not None}")
    if enc:
        print(f"Consent obtained: {enc.get('consent_obtained')}")

asyncio.run(check())
