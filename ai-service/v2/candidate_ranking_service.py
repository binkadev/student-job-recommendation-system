"""Pure bilingual orchestration for candidate-ranking V2."""

from __future__ import annotations

from decimal import localcontext

from .candidate_ranking_schemas import (
    CandidateRankingCandidate,
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult,
)
from .candidate_ranker import rank_candidates
from .constants import (
    ALGORITHM,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD,
)
from .language_detector import (
    LanguageDetection,
    detect_job_language,
    detect_language,
)
from .recommender import _SCORING_DECIMAL_CONTEXT
from .schemas import LanguageCode
from .skill_canonicalizer import SkillCatalog, load_default_catalog


_SUPPORTED_LANGUAGES = frozenset(
    {LanguageCode.ENGLISH, LanguageCode.VIETNAMESE}
)


def _confident_language(
    detection: LanguageDetection,
) -> LanguageCode | None:
    if (
        detection.language_code in _SUPPORTED_LANGUAGES
        and detection.confidence >= ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        return detection.language_code
    return None


def rank_candidate_request(
    request: CandidateRankingRequest,
    *,
    catalog: SkillCatalog | None = None,
) -> CandidateRankingResponse:
    """Rank all request Candidates with one shared bilingual scoring pass."""

    if not isinstance(request, CandidateRankingRequest):
        raise TypeError("request must be a CandidateRankingRequest")

    active_catalog = load_default_catalog() if catalog is None else catalog
    if not isinstance(active_catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")

    with localcontext(_SCORING_DECIMAL_CONTEXT):
        job_detection = detect_job_language(request.job.text)
    job_language = _confident_language(job_detection)
    same_language_candidates: list[
        tuple[CandidateRankingCandidate, LanguageDetection]
    ] = []
    cross_language_candidates: list[
        tuple[CandidateRankingCandidate, LanguageDetection]
    ] = []

    for candidate in request.candidates:
        with localcontext(_SCORING_DECIMAL_CONTEXT):
            candidate_detection = detect_language(candidate.text)
        candidate_language = _confident_language(candidate_detection)
        entry = (candidate, candidate_detection)
        if job_language is not None and candidate_language is job_language:
            same_language_candidates.append(entry)
        else:
            cross_language_candidates.append(entry)

    scored = rank_candidates(
        job=request.job,
        job_detection=job_detection,
        same_language_candidates=tuple(same_language_candidates),
        cross_language_candidates=tuple(cross_language_candidates),
        threshold=request.threshold,
        limit=request.limit,
        catalog=active_catalog,
    )
    results = [
        CandidateRankingResult(
            applicationId=result.application_id,
            cvId=result.cv_id,
            score=float(result.score),
            textScore=(
                None
                if result.text_score is None
                else float(result.text_score)
            ),
            skillScore=float(result.skill_score),
            scoringStrategy=result.scoring_strategy,
            matchedSkills=list(result.matched_skills),
            missingSkills=list(result.missing_skills),
        )
        for result in scored
    ]
    return CandidateRankingResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=CANDIDATE_RANKING_ALGORITHM_VERSION,
        results=results,
    )


# Keep the operation name explicit for callers that model the service method
# after the existing recommendation service.
rank_candidate_applications = rank_candidate_request
