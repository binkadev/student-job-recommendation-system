"""Strict Pydantic schemas for batch/single Job NLP preprocessing."""

from __future__ import annotations

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from core.constants import PROCESSING_VERSION

from .common import (
    ContractModel,
    JobText,
    LanguageCode,
    LanguageConfidence,
    PositiveId,
    ProcessedText,
)


JobPreprocessBatch = Annotated[
    list["JobPreprocessItem"],
    Field(strict=True, min_length=1, max_length=100),
]


class JobPreprocessItem(ContractModel):
    """One raw Job document to denoise, detect language, and tokenize."""

    id: PositiveId
    text: JobText


class JobPreprocessRequest(ContractModel):
    """Bounded Job preprocessing batch request."""

    jobs: JobPreprocessBatch

    @model_validator(mode="after")
    def reject_duplicate_job_ids(self) -> Self:
        job_ids = [job.id for job in self.jobs]
        if len(job_ids) != len(set(job_ids)):
            raise ValueError("Job IDs must be unique")
        return self


class JobPreprocessResult(ContractModel):
    """Deterministic Job NLP snapshot result returned to Backend."""

    id: PositiveId
    processedText: ProcessedText | None
    languageCode: LanguageCode
    languageConfidence: LanguageConfidence
    processingVersion: Literal[PROCESSING_VERSION]


class JobPreprocessResponse(ContractModel):
    """Batch response preserving source ordering."""

    results: list[JobPreprocessResult]


__all__ = [
    "JobPreprocessBatch",
    "JobPreprocessItem",
    "JobPreprocessRequest",
    "JobPreprocessResponse",
    "JobPreprocessResult",
]
