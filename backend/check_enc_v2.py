import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def check():
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client.ambient_ai
    ids = ["69cf928f4d5e0d6ef5bde2dc", "69cf918a4d5e0d6ef5bde2d0"]
    for i in ids:
        enc = await db.encounters.find_one({"_id": ObjectId(i)})
        print(f"ID: {i}")
        print(f"Found: {enc is not None}")
        if enc:
            print(f"Consent obtained: {enc.get('consent_obtained')}")
            print(f"Status: {enc.get('status')}")

asyncio.run(check())
