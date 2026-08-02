"""Strict Pydantic models for the candidate-ranking V2 wire contract."""

from decimal import Decimal
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

from .constants import ALGORITHM, CANDIDATE_RANKING_ALGORITHM_VERSION
from .schemas import ScoringStrategy


PositiveId = Annotated[int, Field(strict=True, gt=0)]
Limit = Annotated[int, Field(strict=True, ge=1, le=100)]


def _require_non_blank_text(value: str) -> str:
    if not any(not character.isspace() for character in value):
        raise ValueError("Text must contain a non-whitespace character")
    return value


CandidateRankingText = Annotated[
    str,
    StringConstraints(
        strict=True,
        min_length=1,
        max_length=1_000_000,
    ),
    AfterValidator(_require_non_blank_text),
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
Skills = Annotated[list[Skill], Field(strict=True)]
CandidateRankingJobSkills = Annotated[
    list[Skill],
    Field(strict=True, max_length=100),
]
ResultSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]
CandidateList = Annotated[
    list["CandidateRankingCandidate"],
    Field(strict=True, min_length=1),
]
Results = Annotated[
    list["CandidateRankingResult"],
    Field(strict=True, max_length=100),
]


def _require_numeric_threshold(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("Threshold must be a numeric value")
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
Score = Annotated[
    float,
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
    AfterValidator(_require_public_score_scale),
]


class CandidateRankingModel(BaseModel):
    """Base model that rejects unknown fields at every wire object level."""

    model_config = ConfigDict(extra="forbid", validate_default=True)


class CandidateRankingJob(CandidateRankingModel):
    id: PositiveId
    text: CandidateRankingText
    skills: CandidateRankingJobSkills


class CandidateRankingCandidate(CandidateRankingModel):
    applicationId: PositiveId
    cvId: PositiveId
    text: CandidateRankingText
    skills: Skills


class CandidateRankingRequest(CandidateRankingModel):
    requestId: UUID
    job: CandidateRankingJob
    candidates: CandidateList
    threshold: Threshold
    limit: Limit

    @model_validator(mode="after")
    def reject_duplicate_application_ids(self) -> Self:
        application_ids = [candidate.applicationId for candidate in self.candidates]
        if len(application_ids) != len(set(application_ids)):
            raise ValueError("Application IDs must be unique")
        return self


class CandidateRankingResult(CandidateRankingModel):
    applicationId: PositiveId
    cvId: PositiveId
    score: Score
    textScore: Score | None
    skillScore: Score
    scoringStrategy: ScoringStrategy
    matchedSkills: ResultSkills
    missingSkills: ResultSkills

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


class CandidateRankingResponse(CandidateRankingModel):
    requestId: UUID
    algorithm: Literal[ALGORITHM]
    algorithmVersion: Literal[CANDIDATE_RANKING_ALGORITHM_VERSION]
    results: Results

    @model_validator(mode="after")
    def reject_duplicate_application_ids(self) -> Self:
        application_ids = [result.applicationId for result in self.results]
        if len(application_ids) != len(set(application_ids)):
            raise ValueError("Application IDs must be unique")
        return self
