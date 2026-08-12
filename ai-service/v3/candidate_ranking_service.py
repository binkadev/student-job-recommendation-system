"""Pure Company Candidate Ranking V3 orchestration."""

from __future__ import annotations

from decimal import localcontext

from v2.language_detector import LanguageDetection, detect_job_language
from v2.preprocessor import preprocess_english_job, preprocess_vietnamese_job
from v2.recommender import _SCORING_DECIMAL_CONTEXT
from v2.schemas import LanguageCode
from v2.skill_canonicalizer import SkillCatalog, load_default_catalog

from .candidate_ranker import PreparedCandidate, ScoredCandidate, rank_candidates
from .candidate_ranking_schemas import (
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult,
)
from .constants import ALGORITHM, LANGUAGE_CONFIDENCE_THRESHOLD


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


def _project_result(candidate: ScoredCandidate) -> CandidateRankingResult:
    return CandidateRankingResult(
        applicationId=candidate.application_id,
        cvId=candidate.cv_id,
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
    )


def rank_candidate_request(
    request: CandidateRankingRequest,
    *,
    catalog: SkillCatalog | None = None,
) -> CandidateRankingResponse:
    """Rank persisted Candidate snapshots in independent V3 tiers."""

    if not isinstance(request, CandidateRankingRequest):
        raise TypeError("request must be a CandidateRankingRequest")

    active_catalog = load_default_catalog() if catalog is None else catalog
    if not isinstance(active_catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")

    with localcontext(_SCORING_DECIMAL_CONTEXT):
        job_detection = detect_job_language(request.job.text)
    job_language = _confident_detected_language(job_detection)
    job_canonical_skills = active_catalog.canonicalize_many(request.job.skills)

    primary_candidates: list[PreparedCandidate] = []
    fallback_candidates: list[PreparedCandidate] = []
    for candidate in request.candidates:
        prepared = PreparedCandidate(
            application_id=candidate.applicationId,
            cv_id=candidate.cvId,
            processed_text=candidate.processedText,
            canonical_skills=active_catalog.canonicalize_many(candidate.skills),
        )
        candidate_language = _confident_persisted_language(
            candidate.languageCode,
            candidate.languageConfidence,
        )
        if job_language is not None and candidate_language is job_language:
            primary_candidates.append(prepared)
        else:
            fallback_candidates.append(prepared)

    job_processed_text: str | None = None
    if primary_candidates:
        if job_language is None:
            raise RuntimeError("PRIMARY Candidates require a confident Job language")
        job_processed_text = _preprocess_primary_job(
            text=request.job.text,
            detection=job_detection,
            language_code=job_language,
        )

    scored = rank_candidates(
        job_processed_text=job_processed_text,
        job_canonical_skills=job_canonical_skills,
        primary_candidates=tuple(primary_candidates),
        fallback_candidates=tuple(fallback_candidates),
        threshold=request.threshold,
        primary_limit=request.primaryLimit,
        fallback_limit=request.fallbackLimit,
    )
    return CandidateRankingResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=CANDIDATE_RANKING_ALGORITHM_VERSION,
        results=[_project_result(candidate) for candidate in scored],
    )


__all__ = ["rank_candidate_request"]
