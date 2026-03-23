from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Mock FHIR Server")

@app.post("/{resource}")
async def create_resource(resource: str, data: dict):
    print(f"FHIR: Received {resource} resource creation request")
    return {
        "id": "mock-fhir-id-abc-123",
        "resourceType": resource,
        "status": "created",
        "data": data
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
