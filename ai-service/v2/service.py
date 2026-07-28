"""Pure per-Job bilingual orchestration for the AI service V2 core."""

from __future__ import annotations

from .constants import (
    ALGORITHM,
    ALGORITHM_VERSION,
    ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD,
)
from .language_detector import detect_job_language, detect_language
from .preprocessor import (
    preprocess_english,
    preprocess_english_job,
    preprocess_vietnamese,
    preprocess_vietnamese_job,
)
from .recommender import (
    PreparedJob,
    ScoredRecommendation,
    score_cross_language_recommendations,
    score_same_language_recommendations,
)
from .schemas import (
    LanguageCode,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
    ScoringStrategy,
)
from .skill_canonicalizer import SkillCatalog, load_default_catalog


def recommend_bilingual(
    request: RecommendationRequest,
    *,
    catalog: SkillCatalog | None = None,
) -> RecommendationResponse:
    """Return deterministic English/Vietnamese recommendations under V2."""

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

    cv_canonical_skills = active_catalog.canonicalize_many(request.cv.skills)
    cv_detection = detect_language(request.cv.text)
    cv_language = (
        cv_detection.language_code
        if (
            cv_detection.language_code
            in {LanguageCode.ENGLISH, LanguageCode.VIETNAMESE}
            and cv_detection.confidence
            >= ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
        )
        else None
    )

    cv_processed_text: str | None = None
    if cv_language is LanguageCode.ENGLISH:
        cv_processed_text = preprocess_english(request.cv.text).processed_text
    elif cv_language is LanguageCode.VIETNAMESE:
        cv_processed_text = preprocess_vietnamese(
            request.cv.text
        ).processed_text

    same_language_jobs: list[PreparedJob] = []
    cross_language_jobs: list[PreparedJob] = []
    for job in request.jobs:
        canonical_skills = active_catalog.canonicalize_many(job.skills)
        detection = detect_job_language(job.text)
        confident_job_language = (
            detection.language_code
            if (
                detection.language_code
                in {LanguageCode.ENGLISH, LanguageCode.VIETNAMESE}
                and detection.confidence
                >= ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
            )
            else None
        )

        if cv_language is not None and confident_job_language is cv_language:
            if cv_language is LanguageCode.ENGLISH:
                processed_text = preprocess_english_job(
                    job.text
                ).processed_text
            else:
                processed_text = preprocess_vietnamese_job(
                    job.text
                ).processed_text
            same_language_jobs.append(
                PreparedJob(
                    job_id=job.id,
                    processed_text=processed_text,
                    canonical_skills=canonical_skills,
                )
            )
        else:
            cross_language_jobs.append(
                PreparedJob(
                    job_id=job.id,
                    processed_text="",
                    canonical_skills=canonical_skills,
                )
            )

    candidates: list[ScoredRecommendation] = []
    if same_language_jobs:
        if cv_processed_text is None or cv_language is None:
            raise RuntimeError("same-language Jobs require a prepared CV")
        same_language_arguments = {
            "cv_processed_text": cv_processed_text,
            "cv_canonical_skills": cv_canonical_skills,
            "jobs": tuple(same_language_jobs),
            "threshold": request.threshold,
            "limit": request.limit,
        }
        if cv_language is LanguageCode.VIETNAMESE:
            same_language_arguments["language_code"] = cv_language
        candidates.extend(
            score_same_language_recommendations(**same_language_arguments)
        )

    if cross_language_jobs:
        reason_language = (
            LanguageCode.VIETNAMESE
            if cv_language is LanguageCode.VIETNAMESE
            else LanguageCode.ENGLISH
        )
        candidates.extend(
            score_cross_language_recommendations(
                cv_canonical_skills=cv_canonical_skills,
                jobs=tuple(cross_language_jobs),
                threshold=request.threshold,
                limit=request.limit,
                reason_language=reason_language,
            )
        )

    candidates.sort(key=lambda candidate: candidate.job_id)
    candidates.sort(key=lambda candidate: candidate.score, reverse=True)
    candidates = candidates[: request.limit]

    results = [
        RecommendationResult(
            jobId=candidate.job_id,
            score=float(candidate.score),
            textScore=(
                None
                if candidate.text_score is None
                else float(candidate.text_score)
            ),
            skillScore=float(candidate.skill_score),
            scoringStrategy=(
                ScoringStrategy.SAME_LANGUAGE_HYBRID
                if candidate.text_score is not None
                else ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
            ),
            matchedSkills=sorted(candidate.full_matched_skills)[:100],
            missingSkills=sorted(candidate.full_missing_skills)[:100],
            reason=candidate.reason,
        )
        for candidate in candidates
    ]
    return RecommendationResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=ALGORITHM_VERSION,
        results=results,
    )


# Compatibility alias for older internal imports and regression tests.
# New production code must use recommend_bilingual.
recommend_english = recommend_bilingual
