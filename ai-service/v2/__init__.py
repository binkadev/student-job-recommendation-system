"""Public contract primitives for AI service V2."""

from .constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION
from .schemas import (
    CvInput,
    CvParseResponse,
    JobInput,
    LanguageCode,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
    ScoringStrategy,
)

__all__ = [
    "ALGORITHM",
    "ALGORITHM_VERSION",
    "PROCESSING_VERSION",
    "CvInput",
    "CvParseResponse",
    "JobInput",
    "LanguageCode",
    "RecommendationRequest",
    "RecommendationResponse",
    "RecommendationResult",
    "ScoringStrategy",
]
