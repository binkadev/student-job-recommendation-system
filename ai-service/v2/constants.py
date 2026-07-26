"""Stable identifiers shared by AI service V2 contracts."""

from decimal import ROUND_HALF_UP, Decimal


ALGORITHM = "tfidf-cosine-hybrid"
ALGORITHM_VERSION = "bilingual-recommendation-v2"
PROCESSING_VERSION = "bilingual-nlp-v2-skills-v1"
SKILL_CATALOG_VERSION = "skills-v1"

ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD = 0.65

# AI V2 public scores use one eight-decimal ROUND_HALF_UP projection.
PUBLIC_SCORE_QUANTUM = Decimal("0.00000001")
PUBLIC_SCORE_ROUNDING = ROUND_HALF_UP
