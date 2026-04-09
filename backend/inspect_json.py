import httpx
import asyncio
import json

async def test_full_json():
    auth_url = "https://services-api.a2zhealth.in/v1/users/authenticate/api"
    auth_payload = {
        "client_id": "televet-v3-staging",
        "client_secret": "83fef8ec35f37968a9b684a5c400a54a",
        "grant_type": "client_credentials"
    }
    
    async with httpx.AsyncClient(verify=False) as client:
        # Auth
        auth_resp = await client.post(auth_url, json=auth_payload)
        auth_data = auth_resp.json()
        token = auth_resp.headers.get("Authorization") or auth_data.get("token") or auth_data.get("data", {}).get("token")
        
        # Validate
        val_url = "https://services-api.a2zhealth.in/v1/consults/token-validate"
        test_token = "eW16NUpheDlpRnZvVXlzUkRyZU1YUT09" # Latest provided by user
        
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        val_resp = await client.get(val_url, params={"token": test_token}, headers=headers)
        
        print("JSON STRUCTURE:")
        print(json.dumps(val_resp.json(), indent=2))

if __name__ == "__main__":
    asyncio.run(test_full_json())
