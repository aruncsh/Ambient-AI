import asyncio
import httpx

async def test_demo_id():
    base_url = "http://127.0.0.1:8001/api/v1"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("Testing /summary/demo/generate...")
        # Note: This will likely 404 if 'demo' isn't in DB, but the previous code returned a 200 with hardcoded data. 
        # My change should try to find it in DB.
        res = await client.post(f"{base_url}/summary/demo/generate")
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print(f"Response: {res.json()}")
        else:
            print(f"Error as expected (no demo in DB): {res.text}")

if __name__ == "__main__":
    asyncio.run(test_demo_id())
