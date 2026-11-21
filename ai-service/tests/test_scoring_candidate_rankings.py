"""Focused routing, Global-IDF scoring, ordering, and safety tests for candidate ranking."""

from __future__ import annotations

import pytest

from core.constants import (
    ALGORITHM,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    PROCESSING_VERSION,
)
from nlp.english_pipeline import LoadedSpacyPipeline
from schemas.candidate_ranking import CandidateRankingRequest
from schemas.common import RankingTier, ScoringStrategy
from scoring.tfidf_artifact import TfidfModelArtifact
from services.candidate_ranking_service import rank_candidate_request


REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"
ENGLISH_JOB = (
    "TITLE:\nBackend Developer\n"
    "DESCRIPTION:\nBuild and maintain reliable software services for users.\n"
    "REQUIREMENTS:\nCandidates have software development experience and "
    "project knowledge with Java, Spring Boot, PostgreSQL, and Docker.\n"
    "SKILLS:\nJava Spring Boot PostgreSQL Docker"
)
NON_ENGLISH_JOB = (
    "TITLE:\nDeveloppeur Backend\n"
    "DESCRIPTION:\nNous developpons des services logiciels avec Java et PostgreSQL pour nos utilisateurs.\n"
    "REQUIREMENTS:\nConnaissance de Java, Spring Boot et Docker pour nos projets.\n"
    "SKILLS:\nJava Spring Boot PostgreSQL Docker"
)
LOW_CONFIDENCE_ENGLISH_JOB = "TITLE:\nWe develop"
ENGLISH_PROCESSED_STRONG = (
    "software_engineer backend_developer develop service java spring_boot postgresql docker rest_api"
)
ENGLISH_PROCESSED_WEAK = "frontend_developer react typescript html css"
NON_ENGLISH_PROCESSED = "developpeur java spring_boot postgresql docker"


def _request(
    *,
    job_text: str = ENGLISH_JOB,
    job_skills: list[str] | None = None,
    candidates: list[tuple[int, int, str, list[str], str, float]] | None = None,
    threshold: float = 0,
    primary_limit: int = 100,
    fallback_limit: int = 0,
) -> CandidateRankingRequest:
    if job_skills is None:
        job_skills = ["java", "spring boot", "postgresql", "docker"]
    if candidates is None:
        candidates = [(300, 55, ENGLISH_PROCESSED_STRONG, ["java", "spring boot"], "en", 1.0)]
    return CandidateRankingRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "job": {"id": 10, "text": job_text, "skills": job_skills},
            "candidates": [
                {
                    "applicationId": application_id,
                    "cvId": cv_id,
                    "processedText": processed_text,
                    "skills": skills,
                    "languageCode": language_code,
                    "languageConfidence": confidence,
                    "processingVersion": PROCESSING_VERSION,
                }
                for (
                    application_id,
                    cv_id,
                    processed_text,
                    skills,
                    language_code,
                    confidence,
                ) in candidates
            ],
            "threshold": threshold,
            "primaryLimit": primary_limit,
            "fallbackLimit": fallback_limit,
        }
    )


def test_confident_english_candidate_is_primary_and_never_calls_fit(
    monkeypatch,
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    def forbid_fit(*_args, **_kwargs):
        raise AssertionError("Online candidate ranking must NEVER call .fit()")

    monkeypatch.setattr(tfidf_artifact.vectorizer, "fit", forbid_fit)
    monkeypatch.setattr(tfidf_artifact.vectorizer, "fit_transform", forbid_fit)

    response = rank_candidate_request(
        _request(
            candidates=[
                (301, 51, ENGLISH_PROCESSED_STRONG, ["java", "spring boot", "postgresql", "docker"], "en", 1.0),
                (302, 52, ENGLISH_PROCESSED_WEAK, ["react"], "en", 1.0),
            ],
            primary_limit=10,
            fallback_limit=0,
        ),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    )

    assert response.algorithm == ALGORITHM
    assert response.algorithmVersion == CANDIDATE_RANKING_ALGORITHM_VERSION
    assert [item.applicationId for item in response.results] == [301, 302]
    assert response.results[0].rankingTier is RankingTier.PRIMARY
    assert response.results[0].scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert response.results[0].textScore is not None and response.results[0].textScore > 0.0
    assert response.results[0].rankingScore > response.results[1].rankingScore


@pytest.mark.parametrize(
    ("job_text", "candidate_lang", "candidate_conf"),
    [
        (NON_ENGLISH_JOB, "en", 1.0),
        (LOW_CONFIDENCE_ENGLISH_JOB, "en", 1.0),
        (ENGLISH_JOB, "unknown", 0.0),
        (ENGLISH_JOB, "mixed", 0.9),
        (ENGLISH_JOB, "en", 0.64),
    ],
)
def test_non_english_or_low_confidence_candidate_or_job_is_fallback(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
    job_text: str,
    candidate_lang: str,
    candidate_conf: float,
) -> None:
    response = rank_candidate_request(
        _request(
            job_text=job_text,
            candidates=[
                (300, 55, NON_ENGLISH_PROCESSED, ["java", "spring boot", "postgresql", "docker"], candidate_lang, candidate_conf),
            ],
            primary_limit=0,
            fallback_limit=10,
        ),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    )

    result = response.results[0]
    assert result.rankingTier is RankingTier.FALLBACK
    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.overallScore is None
    assert result.rankingScore == result.skillScore == 1.0


def test_independent_primary_and_fallback_tier_limits_and_precedence(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    response = rank_candidate_request(
        _request(
            candidates=[
                (301, 51, ENGLISH_PROCESSED_STRONG, ["java", "spring boot"], "en", 1.0),
                (302, 52, ENGLISH_PROCESSED_WEAK, ["java"], "en", 1.0),
                (303, 53, NON_ENGLISH_PROCESSED, ["java", "spring boot", "postgresql", "docker"], "unknown", 0.0),
                (304, 54, NON_ENGLISH_PROCESSED, ["java", "spring boot", "postgresql"], "unknown", 0.0),
            ],
            primary_limit=1,
            fallback_limit=1,
        ),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    )

    assert [item.applicationId for item in response.results] == [301, 303]
    assert response.results[0].rankingTier is RankingTier.PRIMARY
    assert response.results[1].rankingTier is RankingTier.FALLBACK
    assert response.results[0].rankingScore < response.results[1].rankingScore


def test_global_idf_candidate_score_is_invariant_to_other_candidates(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    target = (301, 51, ENGLISH_PROCESSED_STRONG, ["java", "spring boot"], "en", 1.0)
    extra = (302, 52, ENGLISH_PROCESSED_WEAK, ["react"], "en", 1.0)

    solo = rank_candidate_request(
        _request(candidates=[target], primary_limit=10, fallback_limit=0),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    ).results[0]
    batched = [
        item
        for item in rank_candidate_request(
            _request(candidates=[target, extra], primary_limit=10, fallback_limit=0),
            spacy_pipeline=spacy_pipeline,
            tfidf_artifact=tfidf_artifact,
        ).results
        if item.applicationId == 301
    ][0]

    assert solo.textScore == batched.textScore
    assert solo.rankingScore == batched.rankingScore
