from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def check():
    client = AsyncIOMotorClient("mongodb://localhost:27017/ambient_ai")
    db = client.get_default_database()
    col = db.get_collection("encounters")
    async for doc in col.find({}):
        print(f"ID: {doc.get('_id')}, lab_orders: {doc.get('lab_orders')}, type: {type(doc.get('lab_orders'))}")

if __name__ == "__main__":
    asyncio.run(check())
