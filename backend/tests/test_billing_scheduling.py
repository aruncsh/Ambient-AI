import asyncio
import httpx
from datetime import datetime, timedelta

async def test_scheduling_and_billing():
    base_url = "http://127.0.0.1:8001/api/v1"
    
    # 1. Test Scheduling
    print("Testing Scheduling API...")
    appt_data = {
        "patient_id": "TEST-PATIENT",
        "clinician_id": "Dr. Smith",
        "start_time": datetime.utcnow().isoformat(),
        "end_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        "reason": "Routine Checkup"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create
        res = await client.post(f"{base_url}/scheduling/", json=appt_data)
        print(f"Create Appt: {res.status_code}")
        appt = res.json()
        appt_id = appt.get("_id") or appt.get("id")
        
        # List
        res = await client.get(f"{base_url}/scheduling/")
        print(f"List Appts: {res.status_code}, Found: {len(res.json())}")
        
    # 2. Test Billing
    print("\nTesting Billing API...")
    invoice_data = {
        "patient_id": "TEST-PATIENT",
        "amount": 150.0,
        "due_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        "status": "pending"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create
        res = await client.post(f"{base_url}/billing/", json=invoice_data)
        print(f"Create Invoice: {res.status_code}")
        invoice = res.json()
        inv_id = invoice.get("_id") or invoice.get("id")
        
        # List
        res = await client.get(f"{base_url}/billing/")
        print(f"List Invoices: {res.status_code}, Found: {len(res.json())}")
        
        # Update
        res = await client.patch(f"{base_url}/billing/{inv_id}?status=paid")
        print(f"Update Invoice: {res.status_code}")
        updated_inv = res.json()
        print(f"Status after update: {updated_inv.get('status')}")

if __name__ == "__main__":
    asyncio.run(test_scheduling_and_billing())
