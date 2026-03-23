from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.billing import Invoice

router = APIRouter()

@router.get("/", response_model=List[Invoice])
async def list_invoices(patient_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if patient_id:
        query["patient_id"] = patient_id
    if status:
        query["status"] = status
    return await Invoice.find(query).to_list()

@router.post("/", response_model=Invoice)
async def create_invoice(invoice: Invoice):
    await invoice.insert()
    return invoice

@router.patch("/{id}", response_model=Invoice)
async def update_invoice_status(id: str, status: str):
    invoice = await Invoice.get(id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = status
    await invoice.save()
    return invoice
