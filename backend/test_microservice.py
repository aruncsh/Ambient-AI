
import asyncio
import os
import sys

# Add the project root to sys.path
sys.path.append(os.getcwd())

from app.modules.cureselect import cureselect_client
from app.core.config import settings

async def test_token():
    token = "Yks2WThLVUNZUXZFS04vOFp4R1gxQT09"
    print(f"Testing token: {token}")
    print(f"API Endpoint: {settings.CURESELECT_API_ENDPOINT}")
    
    details = await cureselect_client.get_consult_details(token)
    if details:
        print("Success! Details found:")
        data = details.get("data", {})
        consult = data.get("consult", {})
        info = data.get("info", {})
        print(f"Consult ID: {consult.get('id')}")
        print(f"Info Dict: {info}")
        print(f"Info ID: {info.get('id')}")
        print(f"Info Role: {info.get('role')}")
        print(f"Info Ref Number: {info.get('ref_number')}")
        
    else:
        print("Failed to get consult details.")

if __name__ == "__main__":
    asyncio.run(test_token())
