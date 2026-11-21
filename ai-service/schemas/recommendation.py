"""Strict Pydantic models for Student Job Recommendation."""

from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from core.constants import (
    ALGORITHM,
    PROCESSING_VERSION,
    RECOMMENDATION_ALGORITHM_VERSION,
)

from .common import (
    ContractModel,
    InputSkills,
    JobSkills,
    JobText,
    LanguageCode,
    LanguageConfidence,
    Limit,
    PositiveId,
    ProcessedText,
    RankingTier,
    Reason,
    ResultSkills,
    Score,
    ScoringStrategy,
    Threshold,
)


Results = Annotated[
    list["RecommendationResult"],
    Field(strict=True, max_length=100),
]


class CvSnapshotInput(ContractModel):
    id: PositiveId
    processedText: ProcessedText
    skills: InputSkills
    languageCode: LanguageCode
    languageConfidence: LanguageConfidence
    processingVersion: Literal[PROCESSING_VERSION]


class JobInput(ContractModel):
    id: PositiveId
    text: JobText | None = None
    skills: JobSkills
    processedText: ProcessedText | None = None
    languageCode: LanguageCode | None = None
    languageConfidence: LanguageConfidence | None = None
    processingVersion: str | None = None

    @model_validator(mode="after")
    def require_text_or_valid_snapshot(self) -> Self:
        if self.text is not None:
            return self
        has_snapshot_meta = (
            self.processingVersion == PROCESSING_VERSION
            and self.languageCode is not None
            and self.languageConfidence is not None
        )
        if not has_snapshot_meta:
            raise ValueError(
                "JobInput requires raw text or complete current-version snapshot metadata"
            )
        if (
            self.languageCode is LanguageCode.ENGLISH
            and self.languageConfidence >= 0.65
            and self.processedText is None
        ):
            raise ValueError(
                "Confident English Job snapshot requires processedText when raw text is omitted"
            )
        return self


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
    algorithmVersion: Literal[RECOMMENDATION_ALGORITHM_VERSION]
    results: Results

    @model_validator(mode="after")
    def reject_duplicate_job_ids(self) -> Self:
        job_ids = [result.jobId for result in self.results]
        if len(job_ids) != len(set(job_ids)):
            raise ValueError("Result Job IDs must be unique")
        return self
