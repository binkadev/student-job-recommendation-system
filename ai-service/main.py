import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

import extractors
import nlp_processor
import recommender

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Job Recommendation AI Service",
    description="Stateless AI compute engine — Integration Contract v1.0",
    version="tfidf-cosine-v1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class CvPayload(BaseModel):
    """CV data passed in from the Java orchestrator."""
    processedText: str
    skills: List[str]


class JobDocument(BaseModel):
    """A single job document supplied by the Java orchestrator."""
    id: int
    processedText: str
    skills: List[str]


class RecommendationRequest(BaseModel):
    """Full request body for POST /internal/v1/recommendations."""
    requestId: str
    cv: CvPayload
    jobs: List[JobDocument]
    threshold: float = 0.1
    limit: int = 20


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    """Liveness probe — returns static service metadata."""
    return {
        "status": "ok",
        "service": "job-recommendation-ai",
        "version": "tfidf-cosine-v1",
    }


@app.post("/internal/v1/cv/parse")
async def parse_cv(file: UploadFile = File(...)):
    """
    Accept a PDF or DOCX CV file, extract raw text, run bilingual NLP
    preprocessing, and return rawText, processedText, and a skills array.
    """
    filename = (file.filename or "").lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF and DOCX are accepted.",
        )

    try:
        raw_text = await extractors.extract_text(file)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {e}")

    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No text could be extracted from the file. The file may be empty or image-based.",
        )

    nlp_result = nlp_processor.process_cv_text(raw_text)

    return {
        "rawText": raw_text,
        "processedText": nlp_result["processedText"],
        "skills": nlp_result["skills"],
    }


@app.post("/internal/v1/recommendations")
def get_recommendations(req: RecommendationRequest):
    """
    Accept pre-processed CV and job data from the Java orchestrator.
    Return ranked recommendations using TF-IDF + Cosine Similarity.
    """
    # Fast-path: no jobs supplied — nothing to score
    if not req.jobs:
        return {
            "requestId": req.requestId,
            "algorithmVersion": "tfidf-cosine-v1",
            "results": [],
        }

    jobs_as_dicts = [j.model_dump() for j in req.jobs]

    results = recommender.generate_recommendations(
        cv_processed_text=req.cv.processedText,
        cv_skills=req.cv.skills,
        jobs=jobs_as_dicts,
        threshold=req.threshold,
        limit=req.limit,
    )

    return {
        "requestId": req.requestId,
        "algorithmVersion": "tfidf-cosine-v1",
        "results": results,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
