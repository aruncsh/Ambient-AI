import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test_mongo():
    uri = "mongodb://127.0.0.1:27017/ambient_ai"
    print(f"Connecting to {uri}...")
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=2000)
    try:
        await client.admin.command('ping')
        print("MongoDB connection successful!")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_mongo())
