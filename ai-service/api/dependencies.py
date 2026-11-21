"""Strict multipart and raw-body bounded request dependencies."""

from __future__ import annotations

from collections.abc import Iterable

from fastapi import Request
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from core.errors import (
    candidate_ranking_capacity_exceeded_error,
    validation_error,
)
from schemas.candidate_ranking import CandidateRankingRequest
from services.runtime import AppRuntime


async def _close_uploads(uploads: Iterable[UploadFile]) -> None:
    for upload in uploads:
        try:
            await upload.close()
        except Exception:
            # Preserve the required sanitized validation result.
            pass


async def require_multipart_cv_file(request: Request) -> UploadFile:
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


async def require_candidate_ranking_request(
    request: Request,
    runtime: AppRuntime,
) -> CandidateRankingRequest:
    """Bound raw request bytes before strict Candidate Ranking validation."""

    raw_body = await request.body()
    if len(raw_body) > runtime.max_candidate_ranking_request_bytes:
        raise candidate_ranking_capacity_exceeded_error()

    media_type = (
        request.headers.get("content-type", "").partition(";")[0].strip()
    )
    if media_type.casefold() != "application/json":
        raise validation_error()

    try:
        candidate_request = CandidateRankingRequest.model_validate_json(
            raw_body
        )
    except ValidationError as error:
        raise validation_error() from error

    if (
        len(candidate_request.candidates)
        > runtime.max_candidate_ranking_candidates
    ):
        raise candidate_ranking_capacity_exceeded_error()
    return candidate_request
