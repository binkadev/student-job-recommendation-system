"""FastAPI wiring for additive Recommendation and Ranking V3 contracts."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Request
from pydantic import ValidationError

from v2.api import V2Runtime, _dereference_generated_json_schema
from v2.http_errors import (
    V2ApiError,
    V2ErrorResponse,
    candidate_ranking_capacity_exceeded_error,
    internal_error,
    unauthorized_error,
    validation_error,
)

from .candidate_ranking_schemas import (
    CandidateRankingRequest,
    CandidateRankingResponse,
)
from .candidate_ranking_service import rank_candidate_request
from .schemas import RecommendationRequest, RecommendationResponse
from .service import recommend_students


_INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"
_ERROR_RESPONSES = {
    status_code: {"model": V2ErrorResponse}
    for status_code in (401, 422, 500)
}
_CANDIDATE_RANKING_ERROR_RESPONSES = {
    status_code: {"model": V2ErrorResponse}
    for status_code in (401, 413, 422, 500)
}
_CANDIDATE_RANKING_REQUEST_SCHEMA = _dereference_generated_json_schema(
    CandidateRankingRequest.model_json_schema()
)
_CANDIDATE_RANKING_OPENAPI = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": _CANDIDATE_RANKING_REQUEST_SCHEMA,
            }
        },
    }
}


async def require_candidate_ranking_request(
    request: Request,
    runtime: V2Runtime,
) -> CandidateRankingRequest:
    """Bound raw request bytes before strict Candidate V3 validation."""

    raw_body = await request.body()
    if len(raw_body) > runtime.max_candidate_ranking_request_bytes:
        raise candidate_ranking_capacity_exceeded_error()

    media_type = request.headers.get("content-type", "").partition(";")[0].strip()
    if media_type.casefold() != "application/json":
        raise validation_error()

    try:
        candidate_request = CandidateRankingRequest.model_validate_json(raw_body)
    except ValidationError as error:
        raise validation_error() from error

    if len(candidate_request.candidates) > runtime.max_candidate_ranking_candidates:
        raise candidate_ranking_capacity_exceeded_error()
    return candidate_request


def create_v3_router(runtime: V2Runtime) -> APIRouter:
    """Create authenticated Student and Company V3 routes."""

    if not isinstance(runtime, V2Runtime):
        raise TypeError("runtime must be a V2Runtime")

    def require_internal_api_key(request: Request) -> None:
        provided_key = request.headers.get(_INTERNAL_API_KEY_HEADER)
        if provided_key is None or not hmac.compare_digest(
            provided_key.encode("utf-8"),
            runtime.internal_api_key.encode("utf-8"),
        ):
            raise unauthorized_error()

    router = APIRouter(
        prefix="/internal/v3",
        dependencies=[Depends(require_internal_api_key)],
    )

    @router.post(
        "/recommendations",
        response_model=RecommendationResponse,
        responses=_ERROR_RESPONSES,
    )
    def recommendations(
        request: RecommendationRequest,
    ) -> RecommendationResponse:
        try:
            return recommend_students(request, catalog=runtime.catalog)
        except V2ApiError:
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
        openapi_extra=_CANDIDATE_RANKING_OPENAPI,
    )
    def candidate_rankings(
        request: CandidateRankingRequest = Depends(
            candidate_ranking_request_dependency
        ),
    ) -> CandidateRankingResponse:
        try:
            return rank_candidate_request(request, catalog=runtime.catalog)
        except V2ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    return router


__all__ = ["create_v3_router", "require_candidate_ranking_request"]
