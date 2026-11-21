"""Deterministic Global-IDF Company Candidate Ranking scoring (.transform() only)."""

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
from .tfidf_artifact import TfidfModelArtifact


@dataclass(frozen=True, slots=True)
class PreparedCandidate:
    """One persisted Candidate snapshot prepared without lexical mutation."""

    application_id: int
    cv_id: int
    processed_text: str
    canonical_skills: frozenset[str]


@dataclass(frozen=True, slots=True)
class ScoredCandidate:
    """One tiered candidate score retaining complete canonical skill evidence."""

    application_id: int
    cv_id: int
    ranking_tier: RankingTier
    ranking_score: Decimal
    overall_score: Decimal | None
    text_score: Decimal | None
    skill_score: Decimal
    scoring_strategy: ScoringStrategy
    full_matched_skills: tuple[str, ...]
    full_missing_skills: tuple[str, ...]


def _reverse_text_scores(
    *,
    job_processed_text: str,
    candidates: tuple[PreparedCandidate, ...],
    tfidf_artifact: TfidfModelArtifact,
) -> tuple[float, ...]:
    """Transform the Job and all PRIMARY Candidates via Global IDF ONLY."""

    scores = tfidf_artifact.transform_and_cosine_similarity(
        query_text=job_processed_text,
        target_texts=[candidate.processed_text for candidate in candidates],
    )
    if len(scores) != len(candidates):
        raise ValueError("TF-IDF returned an unexpected Candidate score count")
    return scores


def _skill_evidence(
    candidate_skills: frozenset[str],
    job_skills: frozenset[str],
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    return (
        tuple(sorted(candidate_skills & job_skills)),
        tuple(sorted(job_skills - candidate_skills)),
    )


def _raw_skill_score(matched_count: int, job_skill_count: int) -> Decimal:
    if job_skill_count == 0:
        return ZERO
    with localcontext(SCORING_DECIMAL_CONTEXT):
        return Decimal(matched_count) / Decimal(job_skill_count)


def _score_primary(
    *,
    job_skills: frozenset[str],
    candidates: tuple[PreparedCandidate, ...],
    raw_text_scores: tuple[float, ...],
    threshold: Decimal,
) -> list[ScoredCandidate]:
    scored: list[ScoredCandidate] = []
    for candidate, raw_text_score_float in zip(
        candidates,
        raw_text_scores,
        strict=True,
    ):
        if not math.isfinite(raw_text_score_float):
            raise ValueError("TF-IDF cosine similarity must be finite")

        matched_skills, missing_skills = _skill_evidence(
            candidate.canonical_skills,
            job_skills,
        )
        raw_text_score = Decimal(str(raw_text_score_float))
        raw_skill_score = _raw_skill_score(
            len(matched_skills),
            len(job_skills),
        )
        with localcontext(SCORING_DECIMAL_CONTEXT):
            raw_overall_score = (
                TEXT_WEIGHT * raw_text_score
                + SKILL_WEIGHT * raw_skill_score
                if job_skills
                else raw_text_score
            )

        text_score = project_public_score(raw_text_score)
        skill_score = project_public_score(raw_skill_score)
        overall_score = project_public_score(raw_overall_score)
        if overall_score < threshold:
            continue
        scored.append(
            ScoredCandidate(
                application_id=candidate.application_id,
                cv_id=candidate.cv_id,
                ranking_tier=RankingTier.PRIMARY,
                ranking_score=overall_score,
                overall_score=overall_score,
                text_score=text_score,
                skill_score=skill_score,
                scoring_strategy=ScoringStrategy.SAME_LANGUAGE_HYBRID,
                full_matched_skills=matched_skills,
                full_missing_skills=missing_skills,
            )
        )
    return scored


def _score_fallback(
    *,
    job_skills: frozenset[str],
    candidates: tuple[PreparedCandidate, ...],
    threshold: Decimal,
) -> list[ScoredCandidate]:
    scored: list[ScoredCandidate] = []
    for candidate in candidates:
        matched_skills, missing_skills = _skill_evidence(
            candidate.canonical_skills,
            job_skills,
        )
        raw_skill_score = _raw_skill_score(
            len(matched_skills),
            len(job_skills),
        )
        skill_score = project_public_score(raw_skill_score)
        if skill_score < threshold:
            continue
        scored.append(
            ScoredCandidate(
                application_id=candidate.application_id,
                cv_id=candidate.cv_id,
                ranking_tier=RankingTier.FALLBACK,
                ranking_score=skill_score,
                overall_score=None,
                text_score=None,
                skill_score=skill_score,
                scoring_strategy=ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                full_matched_skills=matched_skills,
                full_missing_skills=missing_skills,
            )
        )
    return scored


def rank_candidates(
    *,
    job_processed_text: str | None,
    job_canonical_skills: frozenset[str],
    primary_candidates: tuple[PreparedCandidate, ...],
    fallback_candidates: tuple[PreparedCandidate, ...],
    threshold: Decimal,
    primary_limit: int,
    fallback_limit: int,
    tfidf_artifact: TfidfModelArtifact | None = None,
) -> tuple[ScoredCandidate, ...]:
    """Score complete tiers and apply independent deterministic Top-K limits."""

    if not isinstance(job_canonical_skills, frozenset):
        raise TypeError("Job canonical skills must be a frozenset")
    if not isinstance(primary_candidates, tuple):
        raise TypeError("PRIMARY Candidates must be a tuple")
    if not isinstance(fallback_candidates, tuple):
        raise TypeError("FALLBACK Candidates must be a tuple")
    if not isinstance(threshold, Decimal):
        raise TypeError("threshold must be a Decimal")
    if not threshold.is_finite() or threshold < ZERO or threshold > ONE:
        raise ValueError("threshold must be finite and between 0 and 1")
    for name, value in (
        ("primary_limit", primary_limit),
        ("fallback_limit", fallback_limit),
    ):
        if isinstance(value, bool) or not isinstance(value, int):
            raise TypeError(f"{name} must be an integer")
        if value < 0 or value > 100:
            raise ValueError(f"{name} must be between 0 and 100")
    if primary_limit + fallback_limit < 1 or primary_limit + fallback_limit > 100:
        raise ValueError("combined limits must be between 1 and 100")

    ordered_primary = tuple(
        sorted(primary_candidates, key=lambda candidate: candidate.application_id)
    )
    ordered_fallback = tuple(
        sorted(fallback_candidates, key=lambda candidate: candidate.application_id)
    )

    primary_scored: list[ScoredCandidate] = []
    if ordered_primary:
        if not isinstance(job_processed_text, str):
            raise TypeError("PRIMARY scoring requires processed Job text")
        if not isinstance(tfidf_artifact, TfidfModelArtifact):
            raise TypeError("PRIMARY scoring requires a TfidfModelArtifact")
        raw_text_scores = _reverse_text_scores(
            job_processed_text=job_processed_text,
            candidates=ordered_primary,
            tfidf_artifact=tfidf_artifact,
        )
        primary_scored = _score_primary(
            job_skills=job_canonical_skills,
            candidates=ordered_primary,
            raw_text_scores=raw_text_scores,
            threshold=threshold,
        )

    fallback_scored = _score_fallback(
        job_skills=job_canonical_skills,
        candidates=ordered_fallback,
        threshold=threshold,
    )

    primary_scored.sort(key=lambda result: result.application_id)
    primary_scored.sort(key=lambda result: result.ranking_score, reverse=True)
    fallback_scored.sort(key=lambda result: result.application_id)
    fallback_scored.sort(key=lambda result: result.ranking_score, reverse=True)

    return tuple(
        primary_scored[:primary_limit]
        + fallback_scored[:fallback_limit]
    )


__all__ = ["PreparedCandidate", "ScoredCandidate", "rank_candidates"]
