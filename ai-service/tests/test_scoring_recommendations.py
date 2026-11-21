"""Focused routing, Global-IDF scoring, ordering, and safety tests for recommendations."""

from __future__ import annotations

import pytest

from core.constants import (
    ALGORITHM,
    PROCESSING_VERSION,
    RECOMMENDATION_ALGORITHM_VERSION,
)
from nlp.english_pipeline import LoadedSpacyPipeline
from schemas.common import RankingTier, ScoringStrategy
from schemas.recommendation import RecommendationRequest
from scoring.tfidf_artifact import TfidfModelArtifact
from services.recommendation_service import recommend_students


REQUEST_ID = "8ab8a761-8b52-42a6-b589-8a291670f831"
ENGLISH_PROCESSED_CV = "software_engineer develop reliable service java spring_boot postgresql docker"
ENGLISH_JOB = (
    "TITLE:\nBackend Developer\n"
    "DESCRIPTION:\nBuild and maintain reliable software services for users.\n"
    "REQUIREMENTS:\nCandidates have software development experience and "
    "project knowledge with Java, Spring Boot, PostgreSQL, and Docker.\n"
    "SKILLS:\nJava Spring Boot PostgreSQL Docker"
)
NON_ENGLISH_JOB = (
    "TITLE:\nDeveloppeur Backend\n"
    "DESCRIPTION:\nNous developpons des services logiciels et API pour nos utilisateurs avec Java.\n"
    "REQUIREMENTS:\nConnaissance de Java, Spring Boot, PostgreSQL et Docker pour nos projets.\n"
    "SKILLS:\nJava Spring Boot PostgreSQL Docker"
)
MIXED_JOB = (
    "Software Engineer developed reliable REST APIs for users. "
    "Nous travaillons avec des equipes pour les projets dans notre entreprise."
)
UNKNOWN_JOB = "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD"
LOW_CONFIDENCE_ENGLISH_JOB = "TITLE:\nWe develop"


def _request(
    *,
    cv_language: str = "en",
    cv_confidence: float = 1.0,
    cv_text: str = ENGLISH_PROCESSED_CV,
    cv_skills: list[str] | None = None,
    jobs: list[tuple[int, str, list[str]]] | None = None,
    threshold: float = 0,
    limit: int = 100,
) -> RecommendationRequest:
    if cv_skills is None:
        cv_skills = ["java", "spring boot", "postgresql", "docker"]
    if jobs is None:
        jobs = [(10, ENGLISH_JOB, ["java", "spring boot"])]
    return RecommendationRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "cv": {
                "id": 55,
                "processedText": cv_text,
                "skills": cv_skills,
                "languageCode": cv_language,
                "languageConfidence": cv_confidence,
                "processingVersion": PROCESSING_VERSION,
            },
            "jobs": [
                {"id": job_id, "text": text, "skills": skills}
                for job_id, text, skills in jobs
            ],
            "threshold": threshold,
            "limit": limit,
        }
    )


def test_confident_english_pair_is_primary_with_option_c_metadata(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    response = recommend_students(
        _request(jobs=[(10, ENGLISH_JOB, ["java", "spring boot"])]),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    )

    assert response.algorithm == ALGORITHM
    assert response.algorithmVersion == RECOMMENDATION_ALGORITHM_VERSION
    result = response.results[0]
    assert result.rankingTier is RankingTier.PRIMARY
    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.textScore is not None and result.textScore > 0.0
    assert result.overallScore == result.rankingScore


@pytest.mark.parametrize(
    ("cv_language", "cv_confidence", "job_text"),
    [
        ("en", 1.0, NON_ENGLISH_JOB),
        ("en", 1.0, MIXED_JOB),
        ("en", 1.0, UNKNOWN_JOB),
        ("en", 1.0, LOW_CONFIDENCE_ENGLISH_JOB),
        ("unknown", 0.0, ENGLISH_JOB),
        ("mixed", 0.9, ENGLISH_JOB),
        ("en", 0.64, ENGLISH_JOB),
    ],
)
def test_non_english_or_low_confidence_pairs_route_to_fallback(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
    cv_language: str,
    cv_confidence: float,
    job_text: str,
) -> None:
    result = recommend_students(
        _request(
            cv_language=cv_language,
            cv_confidence=cv_confidence,
            jobs=[(10, job_text, ["java"])],
        ),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK
    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.overallScore is None
    assert result.rankingScore == result.skillScore == 1.0


def test_primary_always_precedes_higher_scoring_fallback(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    response = recommend_students(
        _request(
            jobs=[
                (10, ENGLISH_JOB, ["java", "spring boot", "postgresql", "docker", "kubernetes"]),
                (20, NON_ENGLISH_JOB, ["java", "spring boot", "postgresql", "docker"]),
            ]
        ),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    )

    assert [item.jobId for item in response.results] == [10, 20]
    assert response.results[0].rankingTier is RankingTier.PRIMARY
    assert response.results[1].rankingTier is RankingTier.FALLBACK
    assert response.results[0].rankingScore < response.results[1].rankingScore


def test_empty_jobs_returns_empty_results_without_scoring(
    spacy_pipeline: LoadedSpacyPipeline,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    response = recommend_students(
        _request(jobs=[]),
        spacy_pipeline=spacy_pipeline,
        tfidf_artifact=tfidf_artifact,
    )
    assert response.algorithmVersion == RECOMMENDATION_ALGORITHM_VERSION
    assert response.results == []
