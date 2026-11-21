"""Sanitized HTTP error handling for internal AI Service routes."""

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


_SANITIZED_PATH_PREFIXES = ("/internal/",)


def _uses_sanitized_internal_errors(path: str) -> bool:
    return path.startswith(_SANITIZED_PATH_PREFIXES)


class ErrorResponse(BaseModel):
    """Exact two-field sanitized error envelope."""

    model_config = ConfigDict(extra="forbid")

    errorCode: str
    message: str


class ApiError(Exception):
    """A safe error whose public status and body are fully controlled."""

    def __init__(self, status_code: int, error_code: str, message: str) -> None:
        self.status_code = status_code
        self.error_code = error_code
        self.public_message = message
        super().__init__(message)


def validation_error() -> ApiError:
    return ApiError(
        422,
        "VALIDATION_ERROR",
        "Request validation failed.",
    )


def unauthorized_error() -> ApiError:
    return ApiError(
        401,
        "UNAUTHORIZED",
        "Unauthorized internal request.",
    )


def unsupported_file_type_error() -> ApiError:
    return ApiError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "Only PDF and DOCX files are supported.",
    )


def document_too_large_error() -> ApiError:
    return ApiError(
        413,
        "DOCUMENT_TOO_LARGE",
        "The document exceeds the supported size.",
    )


def candidate_ranking_capacity_exceeded_error() -> ApiError:
    return ApiError(
        413,
        "CANDIDATE_RANKING_CAPACITY_EXCEEDED",
        "Candidate ranking request exceeds synchronous capacity.",
    )


def empty_document_error() -> ApiError:
    return ApiError(
        400,
        "EMPTY_DOCUMENT",
        "The document contains no extractable text.",
    )


def document_extraction_error() -> ApiError:
    return ApiError(
        400,
        "DOCUMENT_EXTRACTION_FAILED",
        "The document could not be read.",
    )


def unsupported_language_error() -> ApiError:
    return ApiError(
        422,
        "UNSUPPORTED_LANGUAGE",
        "English input with confidence of at least 0.65 is required.",
    )


def unprocessable_document_error() -> ApiError:
    return ApiError(
        422,
        "UNPROCESSABLE_DOCUMENT",
        "The document does not contain usable English text.",
    )


def internal_error() -> ApiError:
    return ApiError(
        500,
        "INTERNAL_ERROR",
        "Internal service error.",
    )


def error_response(error: ApiError) -> JSONResponse:
    body = ErrorResponse(
        errorCode=error.error_code,
        message=error.public_message,
    )
    return JSONResponse(
        status_code=error.status_code,
        content=body.model_dump(mode="json"),
    )


def install_error_handlers(app: FastAPI) -> None:
    """Install sanitized error handlers over every internal route."""

    @app.exception_handler(ApiError)
    async def handle_api_error(
        _request: Request,
        error: ApiError,
    ) -> JSONResponse:
        return error_response(error)

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        request: Request,
        error: RequestValidationError,
    ):
        if _uses_sanitized_internal_errors(request.url.path):
            return error_response(validation_error())
        return await request_validation_exception_handler(request, error)

    @app.exception_handler(StarletteHttpException)
    async def handle_framework_http_error(
        request: Request,
        error: StarletteHttpException,
    ):
        if (
            _uses_sanitized_internal_errors(request.url.path)
            and error.status_code in {400, 422}
        ):
            return error_response(validation_error())
        return await http_exception_handler(request, error)
