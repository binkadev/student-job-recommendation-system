"""Public contract primitives for Student Recommendation V3."""

from .constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION
from .candidate_ranking_schemas import (
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult,
    CandidateSnapshotInput,
)
from .schemas import (
    CvSnapshotInput,
    JobInput,
    RankingTier,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)


__all__ = [
    "ALGORITHM",
    "ALGORITHM_VERSION",
    "CANDIDATE_RANKING_ALGORITHM_VERSION",
    "PROCESSING_VERSION",
    "CandidateRankingRequest",
    "CandidateRankingResponse",
    "CandidateRankingResult",
    "CandidateSnapshotInput",
    "CvSnapshotInput",
    "JobInput",
    "RankingTier",
    "RecommendationRequest",
    "RecommendationResponse",
    "RecommendationResult",
]
