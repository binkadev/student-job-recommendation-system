"""Pure Student Recommendation V3 orchestration."""

from __future__ import annotations

from v2.language_detector import LanguageDetection, detect_job_language
from v2.preprocessor import preprocess_english_job, preprocess_vietnamese_job
from v2.schemas import LanguageCode
from v2.skill_canonicalizer import SkillCatalog, load_default_catalog

from .constants import (
    ALGORITHM,
    ALGORITHM_VERSION,
    LANGUAGE_CONFIDENCE_THRESHOLD,
)
from .recommender import (
    PreparedJob,
    ScoredRecommendation,
    score_fallback_recommendations,
    score_primary_recommendations,
)
from .schemas import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)


_SUPPORTED_LANGUAGES = frozenset(
    {LanguageCode.ENGLISH, LanguageCode.VIETNAMESE}
)


def _confident_persisted_language(
    language_code: LanguageCode,
    confidence: float,
) -> LanguageCode | None:
    if (
        language_code in _SUPPORTED_LANGUAGES
        and confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        return language_code
    return None


def _confident_detected_language(
    detection: LanguageDetection,
) -> LanguageCode | None:
    if (
        detection.language_code in _SUPPORTED_LANGUAGES
        and detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        return detection.language_code
    return None


def _preprocess_primary_job(
    *,
    text: str,
    detection: LanguageDetection,
    language_code: LanguageCode,
) -> str:
    if language_code is LanguageCode.ENGLISH:
        return preprocess_english_job(
            text,
            detection=detection,
        ).processed_text
    if language_code is LanguageCode.VIETNAMESE:
        return preprocess_vietnamese_job(
            text,
            detection=detection,
        ).processed_text
    raise ValueError("PRIMARY Job must have a supported language")


def _project_result(candidate: ScoredRecommendation) -> RecommendationResult:
    return RecommendationResult(
        jobId=candidate.job_id,
        rankingTier=candidate.ranking_tier,
        rankingScore=float(candidate.ranking_score),
        overallScore=(
            None
            if candidate.overall_score is None
            else float(candidate.overall_score)
        ),
        textScore=(
            None if candidate.text_score is None else float(candidate.text_score)
        ),
        skillScore=float(candidate.skill_score),
        scoringStrategy=candidate.scoring_strategy,
        matchedSkills=sorted(candidate.full_matched_skills)[:100],
        missingSkills=sorted(candidate.full_missing_skills)[:100],
        reason=candidate.reason,
    )


def recommend_students(
    request: RecommendationRequest,
    *,
    catalog: SkillCatalog | None = None,
) -> RecommendationResponse:
    """Recommend Jobs from one persisted CV analysis snapshot."""

    if not isinstance(request, RecommendationRequest):
        raise TypeError("request must be a RecommendationRequest")

    if not request.jobs:
        return RecommendationResponse(
            requestId=request.requestId,
            algorithm=ALGORITHM,
            algorithmVersion=ALGORITHM_VERSION,
            results=[],
        )

    active_catalog = load_default_catalog() if catalog is None else catalog
    if not isinstance(active_catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")

    cv_language = _confident_persisted_language(
        request.cv.languageCode,
        request.cv.languageConfidence,
    )
    cv_canonical_skills = active_catalog.canonicalize_many(request.cv.skills)

    primary_jobs: list[PreparedJob] = []
    fallback_jobs: list[PreparedJob] = []
    for job in request.jobs:
        canonical_skills = active_catalog.canonicalize_many(job.skills)
        detection = detect_job_language(job.text)
        job_language = _confident_detected_language(detection)

        if cv_language is not None and job_language is cv_language:
            primary_jobs.append(
                PreparedJob(
                    job_id=job.id,
                    processed_text=_preprocess_primary_job(
                        text=job.text,
                        detection=detection,
                        language_code=job_language,
                    ),
                    canonical_skills=canonical_skills,
                )
            )
        else:
            fallback_jobs.append(
                PreparedJob(
                    job_id=job.id,
                    processed_text="",
                    canonical_skills=canonical_skills,
                )
            )

    primary: tuple[ScoredRecommendation, ...] = ()
    if primary_jobs:
        if cv_language is None:
            raise RuntimeError("PRIMARY Jobs require a confident CV language")
        primary = score_primary_recommendations(
            cv_processed_text=request.cv.processedText,
            cv_canonical_skills=cv_canonical_skills,
            jobs=tuple(primary_jobs),
            threshold=request.threshold,
            limit=request.limit,
            language_code=cv_language,
        )

    fallback: tuple[ScoredRecommendation, ...] = ()
    if fallback_jobs:
        reason_language = (
            LanguageCode.VIETNAMESE
            if cv_language is LanguageCode.VIETNAMESE
            else LanguageCode.ENGLISH
        )
        fallback = score_fallback_recommendations(
            cv_canonical_skills=cv_canonical_skills,
            jobs=tuple(fallback_jobs),
            threshold=request.threshold,
            limit=request.limit,
            reason_language=reason_language,
        )

    # Each scorer orders by ranking score descending and Job ID ascending.
    # Concatenation therefore applies the V3 tier precedence without comparing
    # the numeric scales across PRIMARY and FALLBACK.
    ordered = (primary + fallback)[: request.limit]
    return RecommendationResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=ALGORITHM_VERSION,
        results=[_project_result(candidate) for candidate in ordered],
    )


__all__ = ["recommend_students"]
