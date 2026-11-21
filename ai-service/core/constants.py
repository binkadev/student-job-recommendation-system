"""Stable contract identifiers and numeric rounding constants."""

from decimal import ROUND_HALF_UP, Decimal


ALGORITHM = "tfidf-cosine-hybrid"
RECOMMENDATION_ALGORITHM_VERSION = "english-global-idf-recommendation-v1"
CANDIDATE_RANKING_ALGORITHM_VERSION = "english-global-idf-candidate-ranking-v1"
PROCESSING_VERSION = "english-spacy-v1-skills-v1"
SKILL_CATALOG_VERSION = "skills-v1"

LANGUAGE_CONFIDENCE_THRESHOLD = 0.65

# Public scores use one eight-decimal ROUND_HALF_UP projection.
PUBLIC_SCORE_QUANTUM = Decimal("0.00000001")
PUBLIC_SCORE_ROUNDING = ROUND_HALF_UP


__all__ = [
    "ALGORITHM",
    "CANDIDATE_RANKING_ALGORITHM_VERSION",
    "LANGUAGE_CONFIDENCE_THRESHOLD",
    "PROCESSING_VERSION",
    "PUBLIC_SCORE_QUANTUM",
    "PUBLIC_SCORE_ROUNDING",
    "RECOMMENDATION_ALGORITHM_VERSION",
    "SKILL_CATALOG_VERSION",
]
