"""FastAPI wiring for the additive Student Recommendation V3 contract."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Request

from v2.api import V2Runtime
from v2.http_errors import (
    V2ApiError,
    V2ErrorResponse,
    internal_error,
    unauthorized_error,
)

from .schemas import RecommendationRequest, RecommendationResponse
from .service import recommend_students


_INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"
_ERROR_RESPONSES = {
    status_code: {"model": V2ErrorResponse}
    for status_code in (401, 422, 500)
}


def create_v3_router(runtime: V2Runtime) -> APIRouter:
    """Create the authenticated Student Recommendation V3 route."""

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

    return router


__all__ = ["create_v3_router"]
