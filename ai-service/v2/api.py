"""FastAPI wiring for the bilingual AI Service V2 contract."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
import hmac
import os
import re

from fastapi import APIRouter, Depends, Request
from starlette.datastructures import UploadFile

from .cv_service import CvParsingService
from .http_errors import (
    V2ApiError,
    V2ErrorResponse,
    internal_error,
    unauthorized_error,
    validation_error,
)
from .schemas import (
    CvParseResponse,
    RecommendationRequest,
    RecommendationResponse,
)
from .service import recommend_bilingual
from .skill_canonicalizer import (
    SkillCatalog,
    load_default_catalog,
)
from .skill_extractor import SkillExtractor


# Deprecated compatibility patch point used by older internal tests/extensions.
# Production execution uses recommend_bilingual unless this alias is replaced.
recommend_english = recommend_bilingual

_MAX_FILE_SIZE_ENVIRONMENT_KEY = "AI_CV_MAX_FILE_SIZE_BYTES"
_CANDIDATE_RANKING_MAX_CANDIDATES_ENVIRONMENT_KEY = (
    "AI_CANDIDATE_RANKING_MAX_CANDIDATES"
)
_CANDIDATE_RANKING_MAX_REQUEST_BYTES_ENVIRONMENT_KEY = (
    "AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES"
)
_INTERNAL_API_KEY_ENVIRONMENT_KEY = "AI_INTERNAL_API_KEY"
_INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"
_MINIMUM_INTERNAL_API_KEY_LENGTH = 32
_DEFAULT_MAX_FILE_SIZE_BYTES = 10_485_760
_DEFAULT_CANDIDATE_RANKING_MAX_CANDIDATES = 500
_DEFAULT_CANDIDATE_RANKING_MAX_REQUEST_BYTES = 8_388_608
_POSITIVE_INTEGER_PATTERN = re.compile(r"[1-9][0-9]*")
_ERROR_RESPONSES = {
    status_code: {"model": V2ErrorResponse}
    for status_code in (400, 401, 413, 415, 422, 500)
}
_CV_MULTIPART_OPENAPI = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "required": ["file"],
                    "properties": {
                        "file": {
                            "type": "string",
                            "format": "binary",
                        }
                    },
                }
            }
        },
    }
}


class V2ConfigurationError(ValueError):
    """Raised before readiness when V2 startup configuration is invalid."""


@dataclass(frozen=True, slots=True)
class V2Runtime:
    """Immutable dependencies shared by both bilingual V2 routes."""

    internal_api_key: str
    max_file_size_bytes: int
    catalog: SkillCatalog
    skill_extractor: SkillExtractor
    cv_service: CvParsingService
    max_candidate_ranking_candidates: int = _DEFAULT_CANDIDATE_RANKING_MAX_CANDIDATES
    max_candidate_ranking_request_bytes: int = (
        _DEFAULT_CANDIDATE_RANKING_MAX_REQUEST_BYTES
    )


def parse_max_file_size_bytes(environment: Mapping[str, str]) -> int:
    """Resolve the upload limit once using strict positive decimal syntax."""

    value = environment.get(_MAX_FILE_SIZE_ENVIRONMENT_KEY)
    if value is None:
        return _DEFAULT_MAX_FILE_SIZE_BYTES
    if not _POSITIVE_INTEGER_PATTERN.fullmatch(value):
        raise V2ConfigurationError(
            f"{_MAX_FILE_SIZE_ENVIRONMENT_KEY} must be a positive integer"
        )
    return int(value)


def _parse_positive_integer(
    environment: Mapping[str, str],
    environment_key: str,
    default: int,
) -> int:
    value = environment.get(environment_key)
    if value is None:
        return default
    if not _POSITIVE_INTEGER_PATTERN.fullmatch(value):
        raise V2ConfigurationError(
            f"{environment_key} must be a positive integer"
        )
    return int(value)


def parse_candidate_ranking_max_candidates(
    environment: Mapping[str, str],
) -> int:
    """Resolve the synchronous candidate-count safeguard."""

    return _parse_positive_integer(
        environment,
        _CANDIDATE_RANKING_MAX_CANDIDATES_ENVIRONMENT_KEY,
        _DEFAULT_CANDIDATE_RANKING_MAX_CANDIDATES,
    )


def parse_candidate_ranking_max_request_bytes(
    environment: Mapping[str, str],
) -> int:
    """Resolve the synchronous serialized-request safeguard."""

    return _parse_positive_integer(
        environment,
        _CANDIDATE_RANKING_MAX_REQUEST_BYTES_ENVIRONMENT_KEY,
        _DEFAULT_CANDIDATE_RANKING_MAX_REQUEST_BYTES,
    )


def parse_internal_api_key(environment: Mapping[str, str]) -> str:
    """Resolve the required shared key without normalizing its value."""

    value = environment.get(_INTERNAL_API_KEY_ENVIRONMENT_KEY)
    if value is None:
        raise V2ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must be configured"
        )
    if not value:
        raise V2ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must not be blank"
        )
    if value != value.strip():
        raise V2ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must not have "
            "leading or trailing whitespace"
        )
    if len(value) < _MINIMUM_INTERNAL_API_KEY_LENGTH:
        raise V2ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must be at least "
            f"{_MINIMUM_INTERNAL_API_KEY_LENGTH} characters"
        )
    return value


def build_v2_runtime(
    *,
    environment: Mapping[str, str] | None = None,
    catalog_loader: Callable[[], SkillCatalog] = load_default_catalog,
) -> V2Runtime:
    """Validate configuration and construct all V2 dependencies once."""

    configured_environment = os.environ if environment is None else environment
    internal_api_key = parse_internal_api_key(configured_environment)
    max_file_size_bytes = parse_max_file_size_bytes(configured_environment)
    max_candidate_ranking_candidates = parse_candidate_ranking_max_candidates(
        configured_environment
    )
    max_candidate_ranking_request_bytes = parse_candidate_ranking_max_request_bytes(
        configured_environment
    )
    catalog = catalog_loader()
    extractor = SkillExtractor.from_catalog(catalog)
    cv_service = CvParsingService(
        max_file_size_bytes=max_file_size_bytes,
        skill_extractor=extractor,
    )
    return V2Runtime(
        internal_api_key=internal_api_key,
        max_file_size_bytes=max_file_size_bytes,
        catalog=catalog,
        skill_extractor=extractor,
        cv_service=cv_service,
        max_candidate_ranking_candidates=max_candidate_ranking_candidates,
        max_candidate_ranking_request_bytes=max_candidate_ranking_request_bytes,
    )


async def require_v2_multipart_file(request: Request) -> UploadFile:
    """Parse one multipart file without exposing framework parser details."""

    content_type = request.headers.get("content-type", "")
    parts = [part.strip() for part in content_type.split(";")]
    if not parts or parts[0].casefold() != "multipart/form-data":
        raise validation_error()

    boundary_values = [
        part.partition("=")[2].strip().strip('"')
        for part in parts[1:]
        if part.partition("=")[0].strip().casefold() == "boundary"
    ]
    if len(boundary_values) != 1 or not boundary_values[0]:
        raise validation_error()

    try:
        form = await request.form()
    except Exception as error:
        raise validation_error() from error

    files = form.getlist("file")
    if len(files) != 1 or not isinstance(files[0], UploadFile):
        await _close_uploads(
            value
            for _, value in form.multi_items()
            if isinstance(value, UploadFile)
        )
        raise validation_error()
    await _close_uploads(
        value
        for _, value in form.multi_items()
        if isinstance(value, UploadFile) and value is not files[0]
    )
    return files[0]


async def _close_uploads(uploads: Iterable[UploadFile]) -> None:
    for upload in uploads:
        try:
            await upload.close()
        except Exception:
            # Preserve the required sanitized validation result.
            pass


def create_v2_router(runtime: V2Runtime) -> APIRouter:
    """Create both bilingual V2 routes over one validated runtime."""

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
        prefix="/internal/v2",
        dependencies=[Depends(require_internal_api_key)],
    )

    @router.post(
        "/cv/parse",
        response_model=CvParseResponse,
        responses=_ERROR_RESPONSES,
        openapi_extra=_CV_MULTIPART_OPENAPI,
    )
    async def parse_cv(
        upload: UploadFile = Depends(require_v2_multipart_file),
    ) -> CvParseResponse:
        try:
            return await runtime.cv_service.parse_upload(upload)
        except V2ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    @router.post(
        "/recommendations",
        response_model=RecommendationResponse,
        responses=_ERROR_RESPONSES,
    )
    def recommendations(
        request: RecommendationRequest,
    ) -> RecommendationResponse:
        try:
            recommendation_callable = recommend_bilingual
            if recommend_english is not recommend_bilingual:
                recommendation_callable = recommend_english
            return recommendation_callable(request, catalog=runtime.catalog)
        except V2ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    return router
