
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['ambient_ai']
    print('Doctors count:', await db.doctors.count_documents({}))
    print('Patients count:', await db.patients.count_documents({}))
    
    # Check for specific user if needed
    # docs = await db.doctors.find().to_list(10)
    # print('Doctors sample:', docs)

if __name__ == "__main__":
    asyncio.run(check())
