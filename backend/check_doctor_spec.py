import asyncio
from app.core.mongodb import init_db
from app.models.user import Doctor
from beanie import PydanticObjectId

async def check():
    await init_db()
    d = await Doctor.get(PydanticObjectId("69d35d2a44ef26a8a42da9e6"))
    if d:
        print(f"ID: {d.id}, Name: {d.name}, Email: {d.email}")
    else:
        print("Not found")

if __name__ == "__main__":
    asyncio.run(check())
