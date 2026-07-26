"""Wire-level regression protection for the existing V1 endpoints."""

from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


def test_v1_recommendations_preserve_legacy_wire_shape_and_defaults(
    monkeypatch,
) -> None:
    captured: dict = {}
    legacy_result = {
        "jobId": 11,
        "score": 0.75,
        "rank": 1,
        "matchedSkills": ["Java"],
        "missingSkills": ["Docker"],
        "reason": "Legacy V1 reason.",
    }

    def fake_generate_recommendations(**kwargs):
        captured.update(kwargs)
        return [legacy_result]

    monkeypatch.setattr(
        main.recommender,
        "generate_recommendations",
        fake_generate_recommendations,
    )
    payload = {
        "requestId": "legacy-non-uuid-request-id",
        "cv": {
            "id": 7,
            "processedText": "java spring boot",
            "skills": ["Java", "Spring Boot"],
        },
        "jobs": [
            {
                "id": 11,
                "processedText": "java backend",
                "skills": ["Java", "Docker"],
            }
        ],
    }

    response = client.post("/internal/v1/recommendations", json=payload)

    assert response.status_code == 200
    assert captured == {
        "cv_processed_text": "java spring boot",
        "cv_skills": ["Java", "Spring Boot"],
        "jobs": payload["jobs"],
        "threshold": 0.1,
        "limit": 20,
    }
    assert response.json() == {
        "requestId": "legacy-non-uuid-request-id",
        "algorithmVersion": "tfidf-cosine-v1",
        "results": [legacy_result],
    }
    assert set(response.json()["results"][0]) == {
        "jobId",
        "score",
        "rank",
        "matchedSkills",
        "missingSkills",
        "reason",
    }
    assert "rankPosition" not in response.json()["results"][0]


def test_v1_empty_jobs_preserves_exact_response_shape() -> None:
    payload = {
        "requestId": "legacy-empty-request",
        "cv": {
            "id": 7,
            "processedText": "java spring boot",
            "skills": ["Java"],
        },
        "jobs": [],
    }

    response = client.post("/internal/v1/recommendations", json=payload)

    assert response.status_code == 200
    assert response.json() == {
        "requestId": "legacy-empty-request",
        "algorithmVersion": "tfidf-cosine-v1",
        "results": [],
    }


def test_v1_cv_parse_preserves_exact_response_shape(monkeypatch) -> None:
    async def fake_extract_text(_file):
        return "Raw Java CV"

    def fake_process_cv_text(raw_text):
        assert raw_text == "Raw Java CV"
        return {
            "processedText": "Java CV",
            "skills": ["Java"],
        }

    monkeypatch.setattr(main.extractors, "extract_text", fake_extract_text)
    monkeypatch.setattr(
        main.nlp_processor,
        "process_cv_text",
        fake_process_cv_text,
    )

    response = client.post(
        "/internal/v1/cv/parse",
        files={
            "file": (
                "legacy.docx",
                b"legacy-v1-fixture",
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document",
            )
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "rawText": "Raw Java CV",
        "processedText": "Java CV",
        "skills": ["Java"],
    }


def test_v1_routes_remain_registered() -> None:
    post_routes = {
        route.path
        for route in main.app.routes
        if "POST" in getattr(route, "methods", set())
    }

    assert "/internal/v1/cv/parse" in post_routes
    assert "/internal/v1/recommendations" in post_routes


def test_v2_routes_are_not_registered_yet() -> None:
    post_routes = {
        route.path
        for route in main.app.routes
        if "POST" in getattr(route, "methods", set())
    }

    assert "/internal/v2/cv/parse" not in post_routes
    assert "/internal/v2/recommendations" not in post_routes
    assert client.post("/internal/v2/cv/parse").status_code == 404
    assert client.post("/internal/v2/recommendations").status_code == 404


def test_health_preserves_v1_metadata_and_adds_v2_versions() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "job-recommendation-ai",
        "version": "tfidf-cosine-v1",
        "supportedContracts": ["v1"],
        "recommendationVersion": "bilingual-recommendation-v2",
        "processingVersion": "bilingual-nlp-v2-skills-v1",
    }


def test_internal_service_does_not_emit_wildcard_cors_headers() -> None:
    response = client.options(
        "/internal/v1/recommendations",
        headers={
            "Origin": "https://example.invalid",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert "access-control-allow-origin" not in response.headers
    assert "access-control-allow-credentials" not in response.headers
