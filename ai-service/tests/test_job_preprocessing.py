"""Contract, service, and snapshot-reuse tests for Job preprocessing and fast scoring."""

from __future__ import annotations

import os
from unittest.mock import patch

from fastapi.testclient import TestClient

import main
from core.constants import PROCESSING_VERSION
from offline.train_tfidf_incremental import (
    _DEFAULT_CATALOG_PATH,
    _DEFAULT_PHRASES_PATH,
    _protected_entity_tokens,
)


def _headers() -> dict[str, str]:
    return {"X-Internal-Api-Key": os.environ["AI_INTERNAL_API_KEY"]}


def test_protected_entity_tokens_include_domain_phrases_and_skills() -> None:
    protected = _protected_entity_tokens(_DEFAULT_CATALOG_PATH, _DEFAULT_PHRASES_PATH)
    assert "java" in protected
    assert "spring_boot" in protected
    # Previously evicted CUSTOM_PHRASE entities are now protected:
    assert "ai_engineer" in protected
    assert "cloud_engineer" in protected
    assert "ui_designer" in protected
    assert "full_stack_engineer" in protected


def test_internal_jobs_preprocess_endpoint_strips_skills_and_handles_non_english() -> None:
    client = TestClient(main.app, raise_server_exceptions=False)
    response = client.post(
        "/internal/jobs/preprocess",
        headers=_headers(),
        json={
            "jobs": [
                {
                    "id": 101,
                    "text": (
                        "TITLE:\nSenior Backend Developer\n"
                        "DESCRIPTION:\nWe build scalable software systems with Java and Spring Boot.\n"
                        "REQUIREMENTS:\nExperience with PostgreSQL and Docker in production.\n"
                        "SKILLS:\nJava, Spring Boot"
                    ),
                },
                {
                    "id": 102,
                    "text": (
                        "TITLE:\nLập trình viên Backend Java\n"
                        "DESCRIPTION:\nChúng tôi phát triển hệ thống phần mềm doanh nghiệp bằng Java và cơ sở dữ liệu.\n"
                        "REQUIREMENTS:\nCó kinh nghiệm làm việc với Spring Boot và Docker."
                    ),
                },
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()["results"]
    assert len(payload) == 2

    en_job = payload[0]
    assert en_job["id"] == 101
    assert en_job["languageCode"] == "en"
    assert en_job["languageConfidence"] >= 0.65
    assert en_job["processingVersion"] == PROCESSING_VERSION
    assert en_job["processedText"] is not None
    assert "spring_boot" in en_job["processedText"]

    vi_job = payload[1]
    assert vi_job["id"] == 102
    assert vi_job["languageCode"] == "unknown"
    assert vi_job["languageConfidence"] < 0.65
    assert vi_job["processingVersion"] == PROCESSING_VERSION
    assert vi_job["processedText"] is None


def test_recommendations_skips_spacy_when_precomputed_job_snapshots_provided() -> None:
    client = TestClient(main.app, raise_server_exceptions=False)
    with (
        patch("services.job_preprocessing_service.detect_job_language") as detect_mock,
        patch("services.job_preprocessing_service.preprocess_english_job") as spacy_mock,
    ):
        response = client.post(
            "/internal/recommendations",
            headers=_headers(),
            json={
                "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
                "cv": {
                    "id": 1,
                    "processedText": "software_engineer java spring_boot postgresql docker",
                    "skills": ["java", "spring boot"],
                    "languageCode": "en",
                    "languageConfidence": 0.99,
                    "processingVersion": PROCESSING_VERSION,
                },
                "jobs": [
                    {
                        "id": 10,
                        "skills": ["java", "spring boot"],
                        "processedText": "software_engineer java spring_boot postgresql",
                        "languageCode": "en",
                        "languageConfidence": 0.99,
                        "processingVersion": PROCESSING_VERSION,
                    },
                    {
                        "id": 11,
                        "skills": ["java"],
                        "processedText": None,
                        "languageCode": "unknown",
                        "languageConfidence": 0.1,
                        "processingVersion": PROCESSING_VERSION,
                    },
                ],
                "threshold": 0.0,
                "limit": 10,
            },
        )

    assert response.status_code == 200
    detect_mock.assert_not_called()
    spacy_mock.assert_not_called()
    results = response.json()["results"]
    assert [r["jobId"] for r in results] == [10, 11]
    assert results[0]["rankingTier"] == "PRIMARY"
    assert results[1]["rankingTier"] == "FALLBACK"


def test_candidate_rankings_skips_spacy_when_precomputed_job_snapshot_provided() -> None:
    client = TestClient(main.app, raise_server_exceptions=False)
    with (
        patch("services.job_preprocessing_service.detect_job_language") as detect_mock,
        patch("services.job_preprocessing_service.preprocess_english_job") as spacy_mock,
    ):
        response = client.post(
            "/internal/candidate-rankings",
            headers=_headers(),
            json={
                "requestId": "11111111-2222-4333-8444-555555555555",
                "job": {
                    "id": 10,
                    "skills": ["java", "spring boot"],
                    "processedText": "software_engineer java spring_boot postgresql",
                    "languageCode": "en",
                    "languageConfidence": 0.99,
                    "processingVersion": PROCESSING_VERSION,
                },
                "candidates": [
                    {
                        "applicationId": 101,
                        "cvId": 1,
                        "processedText": "software_engineer java spring_boot postgresql docker",
                        "skills": ["java", "spring boot"],
                        "languageCode": "en",
                        "languageConfidence": 0.99,
                        "processingVersion": PROCESSING_VERSION,
                    }
                ],
                "threshold": 0.0,
                "primaryLimit": 10,
                "fallbackLimit": 10,
            },
        )

    assert response.status_code == 200
    detect_mock.assert_not_called()
    spacy_mock.assert_not_called()
    assert len(response.json()["results"]) == 1
    assert response.json()["results"][0]["rankingTier"] == "PRIMARY"
