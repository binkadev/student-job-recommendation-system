"""Unified internal FastAPI router for CV parsing, recommendations, and ranking."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.datastructures import UploadFile

from core.errors import ApiError, ErrorResponse, internal_error
from core.security import make_internal_api_key_dependency
from schemas.candidate_ranking import (
    CandidateRankingRequest,
    CandidateRankingResponse,
)
from schemas.cv import CvParseResponse
from schemas.job_preprocessing import (
    JobPreprocessRequest,
    JobPreprocessResponse,
)
from schemas.recommendation import RecommendationRequest, RecommendationResponse
from services.candidate_ranking_service import rank_candidate_request
from services.job_preprocessing_service import preprocess_jobs
from services.recommendation_service import recommend_students
from services.runtime import AppRuntime

from .dependencies import (
    require_candidate_ranking_request,
    require_multipart_cv_file,
)
from .openapi import CANDIDATE_RANKING_OPENAPI, CV_MULTIPART_OPENAPI


_CV_ERROR_RESPONSES = {
    status_code: {"model": ErrorResponse}
    for status_code in (400, 401, 413, 415, 422, 500)
}
_RECOMMENDATION_ERROR_RESPONSES = {
    status_code: {"model": ErrorResponse}
    for status_code in (401, 422, 500)
}
_CANDIDATE_RANKING_ERROR_RESPONSES = {
    status_code: {"model": ErrorResponse}
    for status_code in (401, 413, 422, 500)
}


def create_internal_router(runtime: AppRuntime) -> APIRouter:
    """Create the authenticated /internal router over one validated runtime."""

    if not isinstance(runtime, AppRuntime):
        raise TypeError("runtime must be an AppRuntime")

    router = APIRouter(
        prefix="/internal",
        dependencies=[
            Depends(make_internal_api_key_dependency(runtime.internal_api_key))
        ],
    )

    @router.post(
        "/cv/parse",
        response_model=CvParseResponse,
        responses=_CV_ERROR_RESPONSES,
        openapi_extra=CV_MULTIPART_OPENAPI,
    )
    async def parse_cv(
        upload: UploadFile = Depends(require_multipart_cv_file),
    ) -> CvParseResponse:
        try:
            return await runtime.cv_service.parse_upload(upload)
        except ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    @router.post(
        "/recommendations",
        response_model=RecommendationResponse,
        responses=_RECOMMENDATION_ERROR_RESPONSES,
    )
    def recommendations(
        request: RecommendationRequest,
    ) -> RecommendationResponse:
        try:
            return recommend_students(
                request,
                spacy_pipeline=runtime.spacy_pipeline,
                tfidf_artifact=runtime.tfidf_artifact,
                catalog=runtime.catalog,
            )
        except ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    async def candidate_ranking_request_dependency(
        request: Request,
    ) -> CandidateRankingRequest:
        return await require_candidate_ranking_request(request, runtime)

    @router.post(
        "/candidate-rankings",
        response_model=CandidateRankingResponse,
        responses=_CANDIDATE_RANKING_ERROR_RESPONSES,
        openapi_extra=CANDIDATE_RANKING_OPENAPI,
    )
    def candidate_rankings(
        request: CandidateRankingRequest = Depends(
            candidate_ranking_request_dependency
        ),
    ) -> CandidateRankingResponse:
        try:
            return rank_candidate_request(
                request,
                spacy_pipeline=runtime.spacy_pipeline,
                tfidf_artifact=runtime.tfidf_artifact,
                catalog=runtime.catalog,
            )
        except ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    @router.post(
        "/jobs/preprocess",
        response_model=JobPreprocessResponse,
        responses=_RECOMMENDATION_ERROR_RESPONSES,
    )
    def jobs_preprocess(
        request: JobPreprocessRequest,
    ) -> JobPreprocessResponse:
        try:
            return preprocess_jobs(
                request,
                spacy_pipeline=runtime.spacy_pipeline,
            )
        except ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    return router


__all__ = ["create_internal_router"]
