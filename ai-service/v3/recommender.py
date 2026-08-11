"""Tier-aware Student Recommendation V3 scoring over persisted CV text."""

from dataclasses import dataclass
from decimal import Decimal

from v2.recommender import (
    PreparedJob,
    score_cross_language_recommendations,
    score_same_language_recommendations,
)
from v2.schemas import LanguageCode, ScoringStrategy

from .schemas import RankingTier


@dataclass(frozen=True, slots=True)
class ScoredRecommendation:
    """One V3 score retaining complete canonical skill evidence."""

    job_id: int
    ranking_tier: RankingTier
    ranking_score: Decimal
    overall_score: Decimal | None
    text_score: Decimal | None
    skill_score: Decimal
    scoring_strategy: ScoringStrategy
    full_matched_skills: tuple[str, ...]
    full_missing_skills: tuple[str, ...]
    reason: str


def score_primary_recommendations(
    *,
    cv_processed_text: str,
    cv_canonical_skills: frozenset[str],
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal,
    limit: int,
    language_code: LanguageCode,
) -> tuple[ScoredRecommendation, ...]:
    """Reuse the locked V2 TF-IDF/math primitives with V3 score semantics."""

    scored = score_same_language_recommendations(
        cv_processed_text=cv_processed_text,
        cv_canonical_skills=cv_canonical_skills,
        jobs=jobs,
        threshold=threshold,
        limit=limit,
        language_code=language_code,
    )
    results: list[ScoredRecommendation] = []
    for candidate in scored:
        if candidate.text_score is None:
            raise RuntimeError("PRIMARY scoring must produce textScore")
        results.append(
            ScoredRecommendation(
                job_id=candidate.job_id,
                ranking_tier=RankingTier.PRIMARY,
                ranking_score=candidate.score,
                overall_score=candidate.score,
                text_score=candidate.text_score,
                skill_score=candidate.skill_score,
                scoring_strategy=ScoringStrategy.SAME_LANGUAGE_HYBRID,
                full_matched_skills=candidate.full_matched_skills,
                full_missing_skills=candidate.full_missing_skills,
                reason=candidate.reason,
            )
        )
    return tuple(results)


def score_fallback_recommendations(
    *,
    cv_canonical_skills: frozenset[str],
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal,
    limit: int,
    reason_language: LanguageCode,
) -> tuple[ScoredRecommendation, ...]:
    """Reuse canonical skill-only scoring without presenting an overall score."""

    scored = score_cross_language_recommendations(
        cv_canonical_skills=cv_canonical_skills,
        jobs=jobs,
        threshold=threshold,
        limit=limit,
        reason_language=reason_language,
    )
    results: list[ScoredRecommendation] = []
    for candidate in scored:
        if candidate.text_score is not None:
            raise RuntimeError("FALLBACK scoring must not produce textScore")
        results.append(
            ScoredRecommendation(
                job_id=candidate.job_id,
                ranking_tier=RankingTier.FALLBACK,
                ranking_score=candidate.skill_score,
                overall_score=None,
                text_score=None,
                skill_score=candidate.skill_score,
                scoring_strategy=ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                full_matched_skills=candidate.full_matched_skills,
                full_missing_skills=candidate.full_missing_skills,
                reason=candidate.reason,
            )
        )
    return tuple(results)


__all__ = [
    "PreparedJob",
    "ScoredRecommendation",
    "score_fallback_recommendations",
    "score_primary_recommendations",
]
