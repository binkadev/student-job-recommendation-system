from fastapi import FastAPI
from app.api.routers import api_router

app = FastAPI(title="AI Service")

app.include_router(api_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
