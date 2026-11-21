"""Pure English-only Student Job Recommendation orchestration (Global IDF)."""

from __future__ import annotations

from core.constants import (
    ALGORITHM,
    LANGUAGE_CONFIDENCE_THRESHOLD,
    RECOMMENDATION_ALGORITHM_VERSION,
)
from nlp.english_pipeline import LoadedSpacyPipeline
from nlp.skill_canonicalizer import SkillCatalog, load_default_catalog
from schemas.common import LanguageCode
from schemas.recommendation import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)
from scoring.job_recommender import (
    PreparedJob,
    ScoredRecommendation,
    score_fallback_recommendations,
    score_primary_recommendations,
)
from scoring.tfidf_artifact import TfidfModelArtifact
from services.job_preprocessing_service import resolve_job_lexical_snapshot


def _is_confident_english_persisted(
    language_code: LanguageCode,
    confidence: float,
) -> bool:
    return (
        language_code is LanguageCode.ENGLISH
        and confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
    )


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
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
    catalog: SkillCatalog | None = None,
) -> RecommendationResponse:
    """Recommend Jobs from one persisted English CV snapshot using Global IDF."""

    if not isinstance(request, RecommendationRequest):
        raise TypeError("request must be a RecommendationRequest")
    if not isinstance(spacy_pipeline, LoadedSpacyPipeline):
        raise TypeError("spacy_pipeline must be a LoadedSpacyPipeline")
    if not isinstance(tfidf_artifact, TfidfModelArtifact):
        raise TypeError("tfidf_artifact must be a TfidfModelArtifact")

    if not request.jobs:
        return RecommendationResponse(
            requestId=request.requestId,
            algorithm=ALGORITHM,
            algorithmVersion=RECOMMENDATION_ALGORITHM_VERSION,
            results=[],
        )

    active_catalog = load_default_catalog() if catalog is None else catalog
    if not isinstance(active_catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")

    cv_is_english = _is_confident_english_persisted(
        request.cv.languageCode,
        request.cv.languageConfidence,
    )
    cv_canonical_skills = active_catalog.canonicalize_many(request.cv.skills)

    primary_jobs: list[PreparedJob] = []
    fallback_jobs: list[PreparedJob] = []
    for job in request.jobs:
        canonical_skills = active_catalog.canonicalize_many(job.skills)
        job_is_english, processed_job_text = resolve_job_lexical_snapshot(
            job,
            spacy_pipeline=spacy_pipeline,
            tokenize_if_english=True,
        )

        if cv_is_english and job_is_english and processed_job_text:
            primary_jobs.append(
                PreparedJob(
                    job_id=job.id,
                    processed_text=processed_job_text,
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
        primary = score_primary_recommendations(
            cv_processed_text=request.cv.processedText,
            cv_canonical_skills=cv_canonical_skills,
            jobs=tuple(primary_jobs),
            threshold=request.threshold,
            limit=request.limit,
            tfidf_artifact=tfidf_artifact,
        )

    fallback: tuple[ScoredRecommendation, ...] = ()
    if fallback_jobs:
        fallback = score_fallback_recommendations(
            cv_canonical_skills=cv_canonical_skills,
            jobs=tuple(fallback_jobs),
            threshold=request.threshold,
            limit=request.limit,
        )

    # Concatenation preserves PRIMARY precedence over FALLBACK without comparing
    # non-comparable hybrid vs. skill-only scales.
    ordered = (primary + fallback)[: request.limit]
    return RecommendationResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=RECOMMENDATION_ALGORITHM_VERSION,
        results=[_project_result(candidate) for candidate in ordered],
    )


__all__ = ["recommend_students"]
