"""Strict Pydantic models for the AI service V2 wire contract."""

from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from .constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION


PositiveId = Annotated[int, Field(strict=True, gt=0)]
Limit = Annotated[int, Field(strict=True, ge=1, le=100)]


def _require_numeric_threshold(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("Threshold must be a numeric value")
    return value


Threshold = Annotated[
    Decimal,
    Field(ge=Decimal("0"), le=Decimal("1"), allow_inf_nan=False),
    BeforeValidator(_require_numeric_threshold),
]
Score = Annotated[
    float,
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
]
Skill = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=150,
    ),
]
Text = Annotated[
    str,
    StringConstraints(strict=True, strip_whitespace=True, min_length=1),
]


def _require_non_blank_raw_text(value: str) -> str:
    if not any(not character.isspace() for character in value):
        raise ValueError("Raw text must contain a non-whitespace character")
    return value


RawText = Annotated[
    str,
    StringConstraints(
        strict=True,
        min_length=1,
        max_length=1_000_000,
    ),
    AfterValidator(_require_non_blank_raw_text),
]
ProcessedText = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=1_000_000,
    ),
]
Reason = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=2_000,
    ),
]
WarningCode = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=2_000,
    ),
]
InputSkills = Annotated[list[Skill], Field(strict=True)]
ParsedSkills = Annotated[list[Skill], Field(strict=True, max_length=200)]
Warnings = Annotated[list[WarningCode], Field(strict=True, max_length=100)]
ResultSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]


class ContractModel(BaseModel):
    """Base model that rejects unknown wire fields."""

    model_config = ConfigDict(extra="forbid", validate_default=True)


class LanguageCode(StrEnum):
    ENGLISH = "en"
    VIETNAMESE = "vi"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class ScoringStrategy(StrEnum):
    SAME_LANGUAGE_HYBRID = "SAME_LANGUAGE_HYBRID"
    CROSS_LANGUAGE_SKILL_BASED = "CROSS_LANGUAGE_SKILL_BASED"


class CvParseResponse(ContractModel):
    rawText: RawText
    processedText: ProcessedText
    skills: ParsedSkills
    languageCode: LanguageCode
    languageConfidence: Score
    processingVersion: Literal[PROCESSING_VERSION]
    warnings: Warnings


class CvInput(ContractModel):
    id: PositiveId
    text: Text
    skills: InputSkills


class JobInput(ContractModel):
    id: PositiveId
    text: Text
    skills: InputSkills


class RecommendationRequest(ContractModel):
    requestId: UUID
    cv: CvInput
    jobs: Annotated[list[JobInput], Field(strict=True)]
    threshold: Threshold
    limit: Limit

    @model_validator(mode="after")
    def reject_duplicate_job_ids(self) -> Self:
        job_ids = [job.id for job in self.jobs]
        if len(job_ids) != len(set(job_ids)):
            raise ValueError("Job IDs must be unique")
        return self


class RecommendationResult(ContractModel):
    jobId: PositiveId
    score: Score
    textScore: Score | None
    skillScore: Score
    scoringStrategy: ScoringStrategy
    matchedSkills: ResultSkills
    missingSkills: ResultSkills
    reason: Reason

    @model_validator(mode="after")
    def validate_text_score_for_strategy(self) -> Self:
        if (
            self.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
            and self.textScore is None
        ):
            raise ValueError("Same-language scoring requires textScore")
        if (
            self.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
            and self.textScore is not None
        ):
            raise ValueError("Cross-language scoring requires textScore=null")
        return self


class RecommendationResponse(ContractModel):
    requestId: UUID
    algorithm: Literal[ALGORITHM]
    algorithmVersion: Literal[ALGORITHM_VERSION]
    results: Annotated[list[RecommendationResult], Field(strict=True)]
