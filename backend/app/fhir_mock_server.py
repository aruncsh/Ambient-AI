from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Mock FHIR Server")

@app.post("/fhir/Patient")
async def create_patient(data: dict):
    return {"id": "mock-patient-123", "resourceType": "Patient", **data}

@app.post("/fhir/Encounter")
async def create_encounter(data: dict):
    return {"id": "mock-enc-456", "resourceType": "Encounter", **data}

@app.post("/fhir/Observation")
async def create_observation(data: dict):
    return {"id": "mock-obs-789", "resourceType": "Observation", **data}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
