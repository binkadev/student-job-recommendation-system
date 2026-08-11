"""Strict Pydantic models for Company Candidate Ranking V3."""

from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import Field, model_validator

from v2.schemas import LanguageCode, ScoringStrategy

from .constants import (
    ALGORITHM,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    PROCESSING_VERSION,
)
from .schemas import (
    ContractModel,
    InputSkills,
    JobText,
    LanguageConfidence,
    PositiveId,
    ProcessedText,
    RankingTier,
    ResultSkills,
    Score,
    Skill,
    Threshold,
)


TierLimit = Annotated[int, Field(strict=True, ge=0, le=100)]
JobSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]
CandidateList = Annotated[
    list["CandidateSnapshotInput"],
    Field(strict=True, min_length=1),
]
Results = Annotated[
    list["CandidateRankingResult"],
    Field(strict=True, max_length=100),
]


class CandidateRankingJob(ContractModel):
    id: PositiveId
    text: JobText
    skills: JobSkills


class CandidateSnapshotInput(ContractModel):
    applicationId: PositiveId
    cvId: PositiveId
    processedText: ProcessedText
    skills: InputSkills
    languageCode: LanguageCode
    languageConfidence: LanguageConfidence
    processingVersion: Literal[PROCESSING_VERSION]


class CandidateRankingRequest(ContractModel):
    requestId: UUID
    job: CandidateRankingJob
    candidates: CandidateList
    threshold: Threshold
    primaryLimit: TierLimit
    fallbackLimit: TierLimit

    @model_validator(mode="after")
    def validate_identifiers_and_limits(self) -> Self:
        application_ids = [candidate.applicationId for candidate in self.candidates]
        if len(application_ids) != len(set(application_ids)):
            raise ValueError("Application IDs must be unique")

        total_limit = self.primaryLimit + self.fallbackLimit
        if total_limit < 1 or total_limit > 100:
            raise ValueError("Combined tier limits must be between 1 and 100")
        return self


class CandidateRankingResult(ContractModel):
    applicationId: PositiveId
    cvId: PositiveId
    rankingTier: RankingTier
    rankingScore: Score
    overallScore: Score | None
    textScore: Score | None
    skillScore: Score
    scoringStrategy: ScoringStrategy
    matchedSkills: ResultSkills
    missingSkills: ResultSkills

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


class CandidateRankingResponse(ContractModel):
    requestId: UUID
    algorithm: Literal[ALGORITHM]
    algorithmVersion: Literal[CANDIDATE_RANKING_ALGORITHM_VERSION]
    results: Results

    @model_validator(mode="after")
    def reject_duplicate_application_ids(self) -> Self:
        application_ids = [result.applicationId for result in self.results]
        if len(application_ids) != len(set(application_ids)):
            raise ValueError("Result Application IDs must be unique")
        return self


__all__ = [
    "CANDIDATE_RANKING_ALGORITHM_VERSION",
    "CandidateRankingJob",
    "CandidateRankingRequest",
    "CandidateRankingResponse",
    "CandidateRankingResult",
    "CandidateSnapshotInput",
]
