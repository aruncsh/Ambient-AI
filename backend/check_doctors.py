import asyncio
from app.core.mongodb import init_db
from app.models.user import Doctor

async def check():
    await init_db()
    docs = await Doctor.find_all().to_list()
    for d in docs:
        print(f"ID: {d.id}, Name: {d.name}, Email: {d.email}")

if __name__ == "__main__":
    asyncio.run(check())
