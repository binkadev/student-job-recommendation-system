"""FastAPI wiring for the bilingual AI Service V2 contract."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
import os
import re

from fastapi import APIRouter, Depends, Request
from starlette.datastructures import UploadFile

from .cv_service import CvParsingService
from .http_errors import (
    V2ApiError,
    V2ErrorResponse,
    internal_error,
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


_MAX_FILE_SIZE_ENVIRONMENT_KEY = "AI_CV_MAX_FILE_SIZE_BYTES"
_DEFAULT_MAX_FILE_SIZE_BYTES = 10_485_760
_POSITIVE_INTEGER_PATTERN = re.compile(r"[1-9][0-9]*")
_ERROR_RESPONSES = {
    status_code: {"model": V2ErrorResponse}
    for status_code in (400, 413, 415, 422, 500)
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

    max_file_size_bytes: int
    catalog: SkillCatalog
    skill_extractor: SkillExtractor
    cv_service: CvParsingService


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


def build_v2_runtime(
    *,
    environment: Mapping[str, str] | None = None,
    catalog_loader: Callable[[], SkillCatalog] = load_default_catalog,
) -> V2Runtime:
    """Validate configuration and construct all V2 dependencies once."""

    configured_environment = os.environ if environment is None else environment
    max_file_size_bytes = parse_max_file_size_bytes(configured_environment)
    catalog = catalog_loader()
    extractor = SkillExtractor.from_catalog(catalog)
    cv_service = CvParsingService(
        max_file_size_bytes=max_file_size_bytes,
        skill_extractor=extractor,
    )
    return V2Runtime(
        max_file_size_bytes=max_file_size_bytes,
        catalog=catalog,
        skill_extractor=extractor,
        cv_service=cv_service,
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

    router = APIRouter(prefix="/internal/v2")

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
            return recommend_bilingual(request, catalog=runtime.catalog)
        except V2ApiError:
            raise
        except Exception as error:
            raise internal_error() from error

    return router
