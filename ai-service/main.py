"""FastAPI application entrypoint for the English Job Recommendation AI Service."""

from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from api.router import create_internal_router
from core.constants import (
    ALGORITHM,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    PROCESSING_VERSION,
    RECOMMENDATION_ALGORITHM_VERSION,
)
from core.errors import install_error_handlers
from core.request_context import install_request_context_middleware
from services.runtime import AppRuntime, build_runtime


def create_app(app_runtime: AppRuntime | None = None) -> FastAPI:
    """Construct the FastAPI application wired to one validated AppRuntime."""

    resolved_runtime = build_runtime() if app_runtime is None else app_runtime
    application = FastAPI(
        title="Job Recommendation AI Service",
        description=(
            "Stateless English 3-stage spaCy CV parsing and Global-IDF "
            "tiered job recommendation and candidate ranking engine."
        ),
        version=RECOMMENDATION_ALGORITHM_VERSION,
    )
    install_request_context_middleware(application)
    install_error_handlers(application)

    @application.get("/health")
    def health_check() -> dict[str, object]:
        """Liveness probe exposing active algorithm and loaded model metadata."""

        return {
            "status": "ok",
            "service": "job-recommendation-ai",
            "algorithm": ALGORITHM,
            "recommendationVersion": RECOMMENDATION_ALGORITHM_VERSION,
            "candidateRankingVersion": CANDIDATE_RANKING_ALGORITHM_VERSION,
            "processingVersion": PROCESSING_VERSION,
            "nlpModelHash": resolved_runtime.spacy_pipeline.model_hash,
            "tfidfModelVersion": resolved_runtime.tfidf_artifact.model_version,
            "tfidfModelSource": resolved_runtime.tfidf_artifact.source_kind,
            "tfidfDocCount": resolved_runtime.tfidf_artifact.doc_count,
            "tfidfVocabSize": resolved_runtime.tfidf_artifact.vocab_size,
        }

    application.include_router(create_internal_router(resolved_runtime))
    return application


runtime = build_runtime()
app = create_app(runtime)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
