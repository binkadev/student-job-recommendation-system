"""Strict Pydantic wire contract models for the AI Service."""

from .candidate_ranking import (
    CandidateRankingJob,
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult,
    CandidateSnapshotInput,
)
from .common import (
    ContractModel,
    LanguageCode,
    RankingTier,
    ScoringStrategy,
)
from .cv import CvParseResponse
from .recommendation import (
    CvSnapshotInput,
    JobInput,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)

__all__ = [
    "CandidateRankingJob",
    "CandidateRankingRequest",
    "CandidateRankingResponse",
    "CandidateRankingResult",
    "CandidateSnapshotInput",
    "ContractModel",
    "CvParseResponse",
    "CvSnapshotInput",
    "JobInput",
    "LanguageCode",
    "RankingTier",
    "RecommendationRequest",
    "RecommendationResponse",
    "RecommendationResult",
    "ScoringStrategy",
]
