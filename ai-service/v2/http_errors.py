"""Sanitized HTTP error handling for the internal V2 contract only."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from starlette.exceptions import HTTPException as StarletteHttpException


_V2_PATH_PREFIX = "/internal/v2/"


class V2ErrorResponse(BaseModel):
    """Exact two-field V2 error envelope."""

    model_config = ConfigDict(extra="forbid")

    errorCode: str
    message: str


class V2ApiError(Exception):
    """A safe error whose public status and body are fully controlled."""

    def __init__(self, status_code: int, error_code: str, message: str) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.public_message = message
        super().__init__(message)


def validation_error() -> V2ApiError:
    return V2ApiError(
        422,
        "VALIDATION_ERROR",
        "Request validation failed.",
    )


def unauthorized_error() -> V2ApiError:
    return V2ApiError(
        401,
        "UNAUTHORIZED",
        "Unauthorized internal request.",
    )


def unsupported_file_type_error() -> V2ApiError:
    return V2ApiError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "Only PDF and DOCX files are supported.",
    )


def document_too_large_error() -> V2ApiError:
    return V2ApiError(
        413,
        "DOCUMENT_TOO_LARGE",
        "The document exceeds the supported size.",
    )


def candidate_ranking_capacity_exceeded_error() -> V2ApiError:
    return V2ApiError(
        413,
        "CANDIDATE_RANKING_CAPACITY_EXCEEDED",
        "Candidate ranking request exceeds synchronous capacity.",
    )


def empty_document_error() -> V2ApiError:
    return V2ApiError(
        400,
        "EMPTY_DOCUMENT",
        "The document contains no extractable text.",
    )


def document_extraction_error() -> V2ApiError:
    return V2ApiError(
        400,
        "DOCUMENT_EXTRACTION_FAILED",
        "The document could not be read.",
    )


def unsupported_language_error() -> V2ApiError:
    return V2ApiError(
        422,
        "UNSUPPORTED_LANGUAGE",
        "English input with confidence of at least 0.65 is required.",
    )


def unprocessable_document_error() -> V2ApiError:
    return V2ApiError(
        422,
        "UNPROCESSABLE_DOCUMENT",
        "The document does not contain usable English text.",
    )


def internal_error() -> V2ApiError:
    return V2ApiError(
        500,
        "INTERNAL_ERROR",
        "Internal service error.",
    )


def error_response(error: V2ApiError) -> JSONResponse:
    body = V2ErrorResponse(
        errorCode=error.error_code,
        message=error.public_message,
    )
    return JSONResponse(
        status_code=error.status_code,
        content=body.model_dump(mode="json"),
    )


def install_v2_error_handlers(app: FastAPI) -> None:
    """Install V2 sanitizers while delegating every V1 case unchanged."""

    @app.exception_handler(V2ApiError)
    async def handle_v2_api_error(
        _request: Request,
        error: V2ApiError,
    ) -> JSONResponse:
        return error_response(error)

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        request: Request,
        error: RequestValidationError,
    ):
        if request.url.path.startswith(_V2_PATH_PREFIX):
            return error_response(validation_error())
        return await request_validation_exception_handler(request, error)

    @app.exception_handler(StarletteHttpException)
    async def handle_framework_http_error(
        request: Request,
        error: StarletteHttpException,
    ):
        if (
            request.url.path.startswith(_V2_PATH_PREFIX)
            and error.status_code in {400, 422}
        ):
            return error_response(validation_error())
        return await http_exception_handler(request, error)
