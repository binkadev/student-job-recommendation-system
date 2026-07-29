import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import List

import extractors
import nlp_processor
import recommender
from request_context import install_request_context_middleware
from v2.api import build_v2_runtime, create_v2_router
from v2.constants import ALGORITHM_VERSION, PROCESSING_VERSION
from v2.http_errors import install_v2_error_handlers


LEGACY_V1_VERSION = "tfidf-cosine-v1"

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Bilingual Job Recommendation AI Service",
    description=(
        "Stateless English/Vietnamese CV parsing and job recommendation "
        "engine supporting internal Contracts V1 and V2."
    ),
    version=ALGORITHM_VERSION,
)
install_request_context_middleware(app)
v2_runtime = build_v2_runtime()
install_v2_error_handlers(app)

# ---------------------------------------------------------------------------
# Pydantic Schemas for the compatibility V1 contract
# ---------------------------------------------------------------------------


class CvPayload(BaseModel):
    """CV data passed in from the Java orchestrator through V1."""

    model_config = ConfigDict(extra="forbid")

    id: int = Field(gt=0, description="CV record ID — must be a positive integer")
    processedText: str
    skills: List[str]


class JobDocument(BaseModel):
    """A single V1 job document supplied by the Java orchestrator."""

    id: int
    processedText: str
    skills: List[str]


class RecommendationRequest(BaseModel):
    """Compatibility request body for POST /internal/v1/recommendations."""

    requestId: str
    cv: CvPayload
    jobs: List[JobDocument]
    threshold: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity score [0.0, 1.0]",
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of results [1, 100]",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health_check():
    """Liveness probe with legacy V1 and current bilingual V2 metadata."""

    return {
        "status": "ok",
        "service": "job-recommendation-ai",
        # Preserved for compatibility with V1 health consumers.
        "version": LEGACY_V1_VERSION,
        "supportedContracts": ["v1", "v2"],
        "recommendationVersion": ALGORITHM_VERSION,
        "processingVersion": PROCESSING_VERSION,
    }


@app.post("/internal/v1/cv/parse")
async def parse_cv(file: UploadFile = File(...)):
    """
    Compatibility V1 route. Accept a PDF or DOCX CV file, extract raw text,
    run the legacy bilingual preprocessing path, and return rawText,
    processedText, and skills.
    """

    filename = (file.filename or "").lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF and DOCX are accepted.",
        )

    try:
        raw_text = await extractors.extract_text(file)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"File extraction failed: {error}",
        ) from error

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No text could be extracted from the file. "
                "The file may be empty or image-based."
            ),
        )

    nlp_result = nlp_processor.process_cv_text(raw_text)

    return {
        "rawText": raw_text,
        "processedText": nlp_result["processedText"],
        "skills": nlp_result["skills"],
    }


@app.post("/internal/v1/recommendations")
def get_recommendations(req: RecommendationRequest):
    """Run the compatibility V1 TF-IDF recommendation behavior."""

    if not req.jobs:
        return {
            "requestId": req.requestId,
            "algorithmVersion": LEGACY_V1_VERSION,
            "results": [],
        }

    jobs_as_dicts = [job.model_dump() for job in req.jobs]

    results = recommender.generate_recommendations(
        cv_processed_text=req.cv.processedText,
        cv_skills=req.cv.skills,
        jobs=jobs_as_dicts,
        threshold=req.threshold,
        limit=req.limit,
    )

    return {
        "requestId": req.requestId,
        "algorithmVersion": LEGACY_V1_VERSION,
        "results": results,
    }


app.include_router(create_v2_router(v2_runtime))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
