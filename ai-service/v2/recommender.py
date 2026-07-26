"""Deterministic same-language and cross-language recommendation scoring."""

from dataclasses import dataclass
from decimal import Context, Decimal, localcontext
import math

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .constants import PUBLIC_SCORE_QUANTUM, PUBLIC_SCORE_ROUNDING
from .reason_generator import (
    generate_cross_language_reason,
    generate_same_language_reason,
)
from .schemas import LanguageCode


_TEXT_WEIGHT = Decimal("0.65")
_SKILL_WEIGHT = Decimal("0.35")
_ZERO = Decimal("0")
_ONE = Decimal("1")
# Never inherit a caller thread's mutable Decimal precision or rounding mode.
_SCORING_DECIMAL_CONTEXT = Context(
    prec=50,
    rounding=PUBLIC_SCORE_ROUNDING,
)


@dataclass(frozen=True, slots=True)
class PreparedJob:
    """One fully preprocessed Job ready for same-language scoring."""

    job_id: int
    processed_text: str
    canonical_skills: frozenset[str]


@dataclass(frozen=True, slots=True)
class ScoredRecommendation:
    """Internal score result retaining complete skill evidence."""

    job_id: int
    score: Decimal
    text_score: Decimal | None
    skill_score: Decimal
    full_matched_skills: tuple[str, ...]
    full_missing_skills: tuple[str, ...]
    reason: str


def project_public_score(value: Decimal | float | int) -> Decimal:
    """Clamp and project a finite numeric score once to eight decimals."""

    if isinstance(value, bool) or not isinstance(value, (Decimal, float, int)):
        raise TypeError("Public score must be a Decimal, float, or integer")

    projected = Decimal(str(value))
    if not projected.is_finite():
        raise ValueError("Public score must be finite")

    if projected <= _ZERO:
        projected = _ZERO
    elif projected >= _ONE:
        projected = _ONE

    with localcontext(_SCORING_DECIMAL_CONTEXT):
        return projected.quantize(
            PUBLIC_SCORE_QUANTUM,
            rounding=PUBLIC_SCORE_ROUNDING,
        )


def _validate_scoring_controls(*, threshold: Decimal, limit: int) -> None:
    if not isinstance(threshold, Decimal):
        raise TypeError("Threshold must be a Decimal")
    if not threshold.is_finite() or threshold < _ZERO or threshold > _ONE:
        raise ValueError("Threshold must be finite and between 0 and 1")
    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("Limit must be an integer")
    if limit < 1 or limit > 100:
        raise ValueError("Limit must be between 1 and 100")


def _is_empty_vocabulary_error(error: ValueError) -> bool:
    return "empty vocabulary" in str(error).casefold()


def _calculate_text_scores(
    cv_processed_text: str,
    jobs: tuple[PreparedJob, ...],
) -> tuple[float, ...]:
    vectorizer = TfidfVectorizer(
        analyzer="word",
        tokenizer=str.split,
        token_pattern=None,
        lowercase=False,
        ngram_range=(1, 2),
        sublinear_tf=True,
        stop_words=None,
    )
    try:
        job_vectors = vectorizer.fit_transform(
            [job.processed_text for job in jobs]
        )
    except ValueError as error:
        if not _is_empty_vocabulary_error(error):
            raise
        return tuple(0.0 for _job in jobs)

    cv_vector = vectorizer.transform([cv_processed_text])
    similarities = cosine_similarity(cv_vector, job_vectors).ravel()
    return tuple(float(similarity) for similarity in similarities)


def score_same_language_recommendations(
    *,
    cv_processed_text: str,
    cv_canonical_skills: frozenset[str],
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal,
    limit: int,
    language_code: LanguageCode = LanguageCode.ENGLISH,
) -> tuple[ScoredRecommendation, ...]:
    """Score confidently English CV and Job documents deterministically."""

    _validate_scoring_controls(threshold=threshold, limit=limit)
    if not isinstance(cv_processed_text, str):
        raise TypeError("CV processed text must be a string")
    if not isinstance(cv_canonical_skills, frozenset):
        raise TypeError("CV canonical skills must be a frozenset")
    if not isinstance(jobs, tuple):
        raise TypeError("Prepared Jobs must be a tuple")
    if not jobs:
        return ()

    raw_text_scores = _calculate_text_scores(cv_processed_text, jobs)
    candidates: list[ScoredRecommendation] = []

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
        with localcontext(_SCORING_DECIMAL_CONTEXT):
            if job_skill_count:
                raw_skill_score = (
                    Decimal(matched_count) / Decimal(job_skill_count)
                )
                raw_score = (
                    _TEXT_WEIGHT * raw_text_score
                    + _SKILL_WEIGHT * raw_skill_score
                )
            else:
                raw_skill_score = _ZERO
                raw_score = raw_text_score

        text_score = project_public_score(raw_text_score)
        skill_score = project_public_score(raw_skill_score)
        score = project_public_score(raw_score)
        if score < threshold:
            continue

        reason_arguments = {
            "text_score": text_score,
            "skill_score": skill_score,
            "full_matched_skills": full_matched_skills,
            "matched_count": matched_count,
            "missing_count": missing_count,
            "job_skill_count": job_skill_count,
        }
        if language_code is LanguageCode.VIETNAMESE:
            reason_arguments["language_code"] = language_code
        reason = generate_same_language_reason(**reason_arguments)
        candidates.append(
            ScoredRecommendation(
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
    reason_language: LanguageCode,
) -> tuple[ScoredRecommendation, ...]:
    """Score unsafe-language pairs using complete canonical skills only."""

    _validate_scoring_controls(threshold=threshold, limit=limit)
    if not isinstance(cv_canonical_skills, frozenset):
        raise TypeError("CV canonical skills must be a frozenset")
    if not isinstance(jobs, tuple):
        raise TypeError("Prepared Jobs must be a tuple")

    candidates: list[ScoredRecommendation] = []
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
        with localcontext(_SCORING_DECIMAL_CONTEXT):
            raw_skill_score = (
                Decimal(matched_count) / Decimal(job_skill_count)
                if job_skill_count
                else _ZERO
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
            language_code=reason_language,
        )
        candidates.append(
            ScoredRecommendation(
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
