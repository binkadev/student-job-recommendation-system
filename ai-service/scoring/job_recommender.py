"""Deterministic Global-IDF Student Job Recommendation scoring (.transform() only)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, localcontext
import math

from schemas.common import RankingTier, ScoringStrategy

from .math_utils import (
    ONE,
    SCORING_DECIMAL_CONTEXT,
    SKILL_WEIGHT,
    TEXT_WEIGHT,
    ZERO,
    project_public_score,
)
from .reason_generator import (
    generate_cross_language_reason,
    generate_same_language_reason,
)
from .tfidf_artifact import TfidfModelArtifact


@dataclass(frozen=True, slots=True)
class PreparedJob:
    """One preprocessed Job ready for Global-IDF lexical or skill scoring."""

    job_id: int
    processed_text: str
    canonical_skills: frozenset[str]


@dataclass(frozen=True, slots=True)
class ScoredJob:
    """Base internal score result retaining complete skill evidence."""

    job_id: int
    score: Decimal
    text_score: Decimal | None
    skill_score: Decimal
    full_matched_skills: tuple[str, ...]
    full_missing_skills: tuple[str, ...]
    reason: str


@dataclass(frozen=True, slots=True)
class ScoredRecommendation:
    """One tiered score retaining complete canonical skill evidence."""

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


def _validate_scoring_controls(*, threshold: Decimal, limit: int) -> None:
    if not isinstance(threshold, Decimal):
        raise TypeError("Threshold must be a Decimal")
    if not threshold.is_finite() or threshold < ZERO or threshold > ONE:
        raise ValueError("Threshold must be finite and between 0 and 1")
    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("Limit must be an integer")
    if limit < 1 or limit > 100:
        raise ValueError("Limit must be between 1 and 100")


def _calculate_text_scores(
    cv_processed_text: str,
    jobs: tuple[PreparedJob, ...],
    *,
    tfidf_artifact: TfidfModelArtifact,
) -> tuple[float, ...]:
    """Compute Global-IDF cosine similarities via .transform() ONLY."""

    return tfidf_artifact.transform_and_cosine_similarity(
        query_text=cv_processed_text,
        target_texts=[job.processed_text for job in jobs],
    )


def score_same_language_recommendations(
    *,
    cv_processed_text: str,
    cv_canonical_skills: frozenset[str],
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal,
    limit: int,
    tfidf_artifact: TfidfModelArtifact,
) -> tuple[ScoredJob, ...]:
    """Score English CV and Job documents deterministically using Global IDF."""

    _validate_scoring_controls(threshold=threshold, limit=limit)
    if not isinstance(cv_processed_text, str):
        raise TypeError("CV processed text must be a string")
    if not isinstance(cv_canonical_skills, frozenset):
        raise TypeError("CV canonical skills must be a frozenset")
    if not isinstance(jobs, tuple):
        raise TypeError("Prepared Jobs must be a tuple")
    if not isinstance(tfidf_artifact, TfidfModelArtifact):
        raise TypeError("tfidf_artifact must be a TfidfModelArtifact")
    if not jobs:
        return ()

    raw_text_scores = _calculate_text_scores(
        cv_processed_text,
        jobs,
        tfidf_artifact=tfidf_artifact,
    )
    candidates: list[ScoredJob] = []

    for job, raw_text_score_float in zip(
        jobs,
        raw_text_scores,
        strict=True,
    ):
        if not math.isfinite(raw_text_score_float):
            raise ValueError("TF-IDF cosine similarity must be finite")

        full_matched_skills = tuple(
            sorted(cv_canonical_skills & job.canonical_skills)
        )
        full_missing_skills = tuple(
            sorted(job.canonical_skills - cv_canonical_skills)
        )
        matched_count = len(full_matched_skills)
        missing_count = len(full_missing_skills)
        job_skill_count = len(job.canonical_skills)

        raw_text_score = Decimal(str(raw_text_score_float))
        with localcontext(SCORING_DECIMAL_CONTEXT):
            if job_skill_count:
                raw_skill_score = (
                    Decimal(matched_count) / Decimal(job_skill_count)
                )
                raw_score = (
                    TEXT_WEIGHT * raw_text_score
                    + SKILL_WEIGHT * raw_skill_score
                )
            else:
                raw_skill_score = ZERO
                raw_score = raw_text_score

        text_score = project_public_score(raw_text_score)
        skill_score = project_public_score(raw_skill_score)
        score = project_public_score(raw_score)
        if score < threshold:
            continue

        reason = generate_same_language_reason(
            text_score=text_score,
            skill_score=skill_score,
            full_matched_skills=full_matched_skills,
            matched_count=matched_count,
            missing_count=missing_count,
            job_skill_count=job_skill_count,
        )
        candidates.append(
            ScoredJob(
                job_id=job.job_id,
                score=score,
                text_score=text_score,
                skill_score=skill_score,
                full_matched_skills=full_matched_skills,
                full_missing_skills=full_missing_skills,
                reason=reason,
            )
        )

    candidates.sort(key=lambda candidate: candidate.job_id)
    candidates.sort(key=lambda candidate: candidate.score, reverse=True)
    return tuple(candidates[:limit])


def score_cross_language_recommendations(
    *,
    cv_canonical_skills: frozenset[str],
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal,
    limit: int,
) -> tuple[ScoredJob, ...]:
    """Score non-English or low-confidence pairs using canonical skills only."""

    _validate_scoring_controls(threshold=threshold, limit=limit)
    if not isinstance(cv_canonical_skills, frozenset):
        raise TypeError("CV canonical skills must be a frozenset")
    if not isinstance(jobs, tuple):
        raise TypeError("Prepared Jobs must be a tuple")

    candidates: list[ScoredJob] = []
    for job in jobs:
        full_matched_skills = tuple(
            sorted(cv_canonical_skills & job.canonical_skills)
        )
        full_missing_skills = tuple(
            sorted(job.canonical_skills - cv_canonical_skills)
        )
        matched_count = len(full_matched_skills)
        missing_count = len(full_missing_skills)
        job_skill_count = len(job.canonical_skills)
        with localcontext(SCORING_DECIMAL_CONTEXT):
            raw_skill_score = (
                Decimal(matched_count) / Decimal(job_skill_count)
                if job_skill_count
                else ZERO
            )
        skill_score = project_public_score(raw_skill_score)
        score = skill_score
        if score < threshold:
            continue

        reason = generate_cross_language_reason(
            skill_score=skill_score,
            full_matched_skills=full_matched_skills,
            matched_count=matched_count,
            missing_count=missing_count,
            job_skill_count=job_skill_count,
        )
        candidates.append(
            ScoredJob(
                job_id=job.job_id,
                score=score,
                text_score=None,
                skill_score=skill_score,
                full_matched_skills=full_matched_skills,
                full_missing_skills=full_missing_skills,
                reason=reason,
            )
        )

    candidates.sort(key=lambda candidate: candidate.job_id)
    candidates.sort(key=lambda candidate: candidate.score, reverse=True)
    return tuple(candidates[:limit])


def score_primary_recommendations(
    *,
    cv_processed_text: str,
    cv_canonical_skills: frozenset[str],
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal,
    limit: int,
    tfidf_artifact: TfidfModelArtifact,
) -> tuple[ScoredRecommendation, ...]:
    """Score English jobs into PRIMARY tier results using Global IDF."""

    scored = score_same_language_recommendations(
        cv_processed_text=cv_processed_text,
        cv_canonical_skills=cv_canonical_skills,
        jobs=jobs,
        threshold=threshold,
        limit=limit,
        tfidf_artifact=tfidf_artifact,
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
) -> tuple[ScoredRecommendation, ...]:
    """Score non-English or low-confidence jobs into FALLBACK tier results."""

    scored = score_cross_language_recommendations(
        cv_canonical_skills=cv_canonical_skills,
        jobs=jobs,
        threshold=threshold,
        limit=limit,
    )
    return tuple(
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
        for candidate in scored
    )


__all__ = [
    "PreparedJob",
    "ScoredJob",
    "ScoredRecommendation",
    "score_cross_language_recommendations",
    "score_fallback_recommendations",
    "score_primary_recommendations",
    "score_same_language_recommendations",
]
