"""Strict Pydantic models for Student Recommendation V3."""

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

from v2.schemas import LanguageCode, ScoringStrategy

from .constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION


PositiveId = Annotated[int, Field(strict=True, gt=0)]
Limit = Annotated[int, Field(strict=True, ge=1, le=100)]


def _require_numeric(value: object, *, field_name: str) -> object:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError(f"{field_name} must be a numeric value")
    return value


def _require_numeric_threshold(value: object) -> object:
    return _require_numeric(value, field_name="Threshold")


def _require_numeric_confidence(value: object) -> object:
    return _require_numeric(value, field_name="Language confidence")


def _require_non_blank_processed_text(value: str) -> str:
    if not any(not character.isspace() for character in value):
        raise ValueError("Processed text must contain a non-whitespace character")
    return value


def _require_public_score_scale(value: float) -> float:
    if Decimal(str(value)).as_tuple().exponent < -8:
        raise ValueError("Scores must have at most 8 decimal places")
    return value


Threshold = Annotated[
    Decimal,
    Field(ge=Decimal("0"), le=Decimal("1"), allow_inf_nan=False),
    BeforeValidator(_require_numeric_threshold),
]
LanguageConfidence = Annotated[
    float,
    Field(ge=0.0, le=1.0, allow_inf_nan=False),
    BeforeValidator(_require_numeric_confidence),
]
Score = Annotated[
    float,
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
    AfterValidator(_require_public_score_scale),
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
JobText = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
    ),
]
ProcessedText = Annotated[
    str,
    StringConstraints(strict=True, min_length=1, max_length=1_000_000),
    AfterValidator(_require_non_blank_processed_text),
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
InputSkills = Annotated[list[Skill], Field(strict=True)]
StudentJobSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]
ResultSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]
Results = Annotated[list["RecommendationResult"], Field(strict=True, max_length=100)]


class ContractModel(BaseModel):
    """Base model that rejects unknown fields at every wire boundary."""

    model_config = ConfigDict(extra="forbid", validate_default=True)


class RankingTier(StrEnum):
    PRIMARY = "PRIMARY"
    FALLBACK = "FALLBACK"


class CvSnapshotInput(ContractModel):
    id: PositiveId
    processedText: ProcessedText
    skills: InputSkills
    languageCode: LanguageCode
    languageConfidence: LanguageConfidence
    processingVersion: Literal[PROCESSING_VERSION]


class JobInput(ContractModel):
    id: PositiveId
    text: JobText
    skills: StudentJobSkills


class RecommendationRequest(ContractModel):
    requestId: UUID
    cv: CvSnapshotInput
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
    rankingTier: RankingTier
    rankingScore: Score
    overallScore: Score | None
    textScore: Score | None
    skillScore: Score
    scoringStrategy: ScoringStrategy
    matchedSkills: ResultSkills
    missingSkills: ResultSkills
    reason: Reason

    @model_validator(mode="after")
    def validate_tier_score_semantics(self) -> Self:
        if self.rankingTier is RankingTier.PRIMARY:
            if self.scoringStrategy is not ScoringStrategy.SAME_LANGUAGE_HYBRID:
                raise ValueError("PRIMARY requires SAME_LANGUAGE_HYBRID")
            if self.textScore is None or self.overallScore is None:
                raise ValueError("PRIMARY requires textScore and overallScore")
            if self.rankingScore != self.overallScore:
                raise ValueError("PRIMARY rankingScore must equal overallScore")
            return self

        if self.scoringStrategy is not ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED:
            raise ValueError("FALLBACK requires CROSS_LANGUAGE_SKILL_BASED")
        if self.textScore is not None or self.overallScore is not None:
            raise ValueError("FALLBACK requires null textScore and overallScore")
        if self.rankingScore != self.skillScore:
            raise ValueError("FALLBACK rankingScore must equal skillScore")
        return self


class RecommendationResponse(ContractModel):
    requestId: UUID
    algorithm: Literal[ALGORITHM]
    algorithmVersion: Literal[ALGORITHM_VERSION]
    results: Results

    @model_validator(mode="after")
    def reject_duplicate_job_ids(self) -> Self:
        job_ids = [result.jobId for result in self.results]
        if len(job_ids) != len(set(job_ids)):
            raise ValueError("Result Job IDs must be unique")
        return self
