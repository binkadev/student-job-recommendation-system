from fastapi import Header, HTTPException
import os

async def verify_internal_api_key(x_internal_api_key: str = Header(...)):
    expected_key = os.getenv("INTERNAL_API_KEY", "default-secret-key")
    if x_internal_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_internal_api_key
