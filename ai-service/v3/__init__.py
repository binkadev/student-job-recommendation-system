"""Public contract primitives for Student Recommendation V3."""

from .constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION
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
    "PROCESSING_VERSION",
    "CvSnapshotInput",
    "JobInput",
    "RankingTier",
    "RecommendationRequest",
    "RecommendationResponse",
    "RecommendationResult",
]
