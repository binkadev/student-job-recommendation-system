"""Pure English-only Company Candidate Ranking orchestration (Global IDF)."""

from __future__ import annotations

from decimal import localcontext

from core.constants import (
    ALGORITHM,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    LANGUAGE_CONFIDENCE_THRESHOLD,
)
from nlp.english_pipeline import LoadedSpacyPipeline
from nlp.skill_canonicalizer import SkillCatalog, load_default_catalog
from schemas.candidate_ranking import (
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult,
)
from schemas.common import LanguageCode
from scoring.candidate_ranker import (
    PreparedCandidate,
    ScoredCandidate,
    rank_candidates,
)
from scoring.math_utils import SCORING_DECIMAL_CONTEXT
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
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
    catalog: SkillCatalog | None = None,
) -> CandidateRankingResponse:
    """Rank persisted Candidate snapshots in PRIMARY/FALLBACK tiers using Global IDF."""

    if not isinstance(request, CandidateRankingRequest):
        raise TypeError("request must be a CandidateRankingRequest")
    if not isinstance(spacy_pipeline, LoadedSpacyPipeline):
        raise TypeError("spacy_pipeline must be a LoadedSpacyPipeline")
    if not isinstance(tfidf_artifact, TfidfModelArtifact):
        raise TypeError("tfidf_artifact must be a TfidfModelArtifact")

    active_catalog = load_default_catalog() if catalog is None else catalog
    if not isinstance(active_catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")

    job_canonical_skills = active_catalog.canonicalize_many(request.job.skills)
    job_is_english, resolved_job_processed = resolve_job_lexical_snapshot(
        request.job,
        spacy_pipeline=spacy_pipeline,
        tokenize_if_english=False,
    )

    primary_candidates: list[PreparedCandidate] = []
    fallback_candidates: list[PreparedCandidate] = []
    for candidate in request.candidates:
        prepared = PreparedCandidate(
            application_id=candidate.applicationId,
            cv_id=candidate.cvId,
            processed_text=candidate.processedText,
            canonical_skills=active_catalog.canonicalize_many(candidate.skills),
        )
        candidate_is_english = _is_confident_english_persisted(
            candidate.languageCode,
            candidate.languageConfidence,
        )
        if job_is_english and candidate_is_english:
            primary_candidates.append(prepared)
        else:
            fallback_candidates.append(prepared)

    job_processed_text: str | None = None
    if primary_candidates:
        if resolved_job_processed:
            job_processed_text = resolved_job_processed
        else:
            _, job_processed_text = resolve_job_lexical_snapshot(
                request.job,
                spacy_pipeline=spacy_pipeline,
                tokenize_if_english=True,
            )

    scored = rank_candidates(
        job_processed_text=job_processed_text,
        job_canonical_skills=job_canonical_skills,
        primary_candidates=tuple(primary_candidates),
        fallback_candidates=tuple(fallback_candidates),
        threshold=request.threshold,
        primary_limit=request.primaryLimit,
        fallback_limit=request.fallbackLimit,
        tfidf_artifact=tfidf_artifact,
    )
    return CandidateRankingResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=CANDIDATE_RANKING_ALGORITHM_VERSION,
        results=[_project_result(candidate) for candidate in scored],
    )


__all__ = ["rank_candidate_request"]
