"""Pure English-baseline orchestration for the AI service V2 core."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

from .constants import ALGORITHM, ALGORITHM_VERSION
from .preprocessor import (
    EnglishPreprocessingResult,
    UnsupportedLanguageError,
    preprocess_english,
    preprocess_english_job,
)
from .recommender import PreparedJob, score_same_language_recommendations
from .schemas import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
    ScoringStrategy,
)
from .skill_canonicalizer import SkillCatalog, load_default_catalog


DocumentKind = Literal["cv", "job"]


class EnglishBaselinePreconditionError(ValueError):
    """Report the exact input that is unsupported by the English baseline."""

    def __init__(
        self,
        *,
        kind: DocumentKind,
        input_id: int,
        unsupported: UnsupportedLanguageError,
    ) -> None:
        self.kind = kind
        self.id = input_id
        self.input_id = input_id
        self.code = unsupported.language_code
        self.language_code = unsupported.language_code
        self.confidence = unsupported.confidence
        super().__init__(
            "English baseline precondition failed for "
            f"{kind} id={input_id}: language={self.code.value}, "
            f"confidence={self.confidence:.8f}"
        )


def recommend_english(
    request: RecommendationRequest,
    *,
    catalog: SkillCatalog | None = None,
) -> RecommendationResponse:
    """Return deterministic same-language recommendations for English input."""

    if not request.jobs:
        return RecommendationResponse(
            requestId=request.requestId,
            algorithm=ALGORITHM,
            algorithmVersion=ALGORITHM_VERSION,
            results=[],
        )

    cv_result = _preprocess_or_raise(
        kind="cv",
        input_id=request.cv.id,
        text=request.cv.text,
        preprocessor=preprocess_english,
    )
    job_results = [
        _preprocess_or_raise(
            kind="job",
            input_id=job.id,
            text=job.text,
            preprocessor=preprocess_english_job,
        )
        for job in request.jobs
    ]

    active_catalog = load_default_catalog() if catalog is None else catalog
    if not isinstance(active_catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")
    cv_canonical_skills = active_catalog.canonicalize_many(request.cv.skills)
    prepared_jobs = tuple(
        PreparedJob(
            job_id=job.id,
            processed_text=job_result.processed_text,
            canonical_skills=active_catalog.canonicalize_many(job.skills),
        )
        for job, job_result in zip(request.jobs, job_results, strict=True)
    )

    candidates = score_same_language_recommendations(
        cv_processed_text=cv_result.processed_text,
        cv_canonical_skills=cv_canonical_skills,
        jobs=prepared_jobs,
        threshold=request.threshold,
        limit=request.limit,
    )

    results = [
        RecommendationResult(
            jobId=candidate.job_id,
            score=float(candidate.score),
            textScore=float(candidate.text_score),
            skillScore=float(candidate.skill_score),
            scoringStrategy=ScoringStrategy.SAME_LANGUAGE_HYBRID,
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


def _preprocess_or_raise(
    *,
    kind: DocumentKind,
    input_id: int,
    text: str,
    preprocessor: Callable[[str], EnglishPreprocessingResult],
) -> EnglishPreprocessingResult:
    try:
        return preprocessor(text)
    except UnsupportedLanguageError as exc:
        raise EnglishBaselinePreconditionError(
            kind=kind,
            input_id=input_id,
            unsupported=exc,
        ) from exc
