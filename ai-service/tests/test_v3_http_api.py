"""Focused HTTP contract tests for Student Recommendation V3."""

import logging
import os

from fastapi.testclient import TestClient

import main
import v3.api as api_module
from request_context import REQUEST_ID_HEADER
from v3.constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION
from v3.schemas import RecommendationResponse


BUSINESS_REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"
TRANSPORT_REQUEST_ID = "transport-v3-request-id"
UNAUTHORIZED_BODY = {
    "errorCode": "UNAUTHORIZED",
    "message": "Unauthorized internal request.",
}
VALIDATION_BODY = {
    "errorCode": "VALIDATION_ERROR",
    "message": "Request validation failed.",
}
INTERNAL_BODY = {
    "errorCode": "INTERNAL_ERROR",
    "message": "Internal service error.",
}


def _payload() -> dict:
    return {
        "requestId": BUSINESS_REQUEST_ID,
        "cv": {
            "id": 55,
            "processedText": "software engineer java spring_boot",
            "skills": ["java", "spring boot"],
            "languageCode": "en",
            "languageConfidence": 1.0,
            "processingVersion": PROCESSING_VERSION,
        },
        "jobs": [
            {
                "id": 10,
                "text": (
                    "TITLE:\nBackend Developer\n"
                    "DESCRIPTION:\nBuild reliable software services for users.\n"
                    "REQUIREMENTS:\nCandidates have development experience and knowledge.\n"
                    "SKILLS:\nJava Spring Boot"
                ),
                "skills": ["java", "spring boot"],
            }
        ],
        "threshold": 0,
        "limit": 20,
    }


def _headers() -> dict[str, str]:
    return {
        "X-Internal-Api-Key": os.environ["AI_INTERNAL_API_KEY"],
        REQUEST_ID_HEADER: TRANSPORT_REQUEST_ID,
    }


def _response(request) -> RecommendationResponse:
    return RecommendationResponse.model_validate(
        {
            "requestId": request.requestId,
            "algorithm": ALGORITHM,
            "algorithmVersion": ALGORITHM_VERSION,
            "results": [
                {
                    "jobId": 10,
                    "rankingTier": "PRIMARY",
                    "rankingScore": 0.72,
                    "overallScore": 0.72,
                    "textScore": 0.65,
                    "skillScore": 0.85,
                    "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                    "matchedSkills": ["java"],
                    "missingSkills": ["spring boot"],
                    "reason": "Same-language evidence was used.",
                }
            ],
        }
    )


def _client() -> TestClient:
    return TestClient(main.app, raise_server_exceptions=False)


def test_valid_request_calls_v3_service_and_returns_exact_contract(monkeypatch) -> None:
    calls = []

    def fake_recommend(request, *, catalog):
        calls.append((request, catalog))
        return _response(request)

    monkeypatch.setattr(api_module, "recommend_students", fake_recommend)
    response = _client().post(
        "/internal/v3/recommendations",
        json=_payload(),
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == TRANSPORT_REQUEST_ID
    assert response.json() == {
        "requestId": BUSINESS_REQUEST_ID,
        "algorithm": "tfidf-cosine-hybrid",
        "algorithmVersion": "bilingual-recommendation-v3",
        "results": [
            {
                "jobId": 10,
                "rankingTier": "PRIMARY",
                "rankingScore": 0.72,
                "overallScore": 0.72,
                "textScore": 0.65,
                "skillScore": 0.85,
                "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                "matchedSkills": ["java"],
                "missingSkills": ["spring boot"],
                "reason": "Same-language evidence was used.",
            }
        ],
    }
    assert len(calls) == 1
    assert calls[0][0].cv.processedText == _payload()["cv"]["processedText"]
    rendered = response.json()["results"][0]
    for forbidden in ("score", "rank", "rankPosition", "tierRankPosition"):
        assert forbidden not in rendered


def test_missing_authentication_is_rejected() -> None:
    response = _client().post(
        "/internal/v3/recommendations",
        json=_payload(),
    )

    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_v3_validation_errors_are_sanitized(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(
        api_module,
        "recommend_students",
        lambda *args, **kwargs: calls.append((args, kwargs)),
    )
    malformed = _client().post(
        "/internal/v3/recommendations",
        content=b'{"requestId":',
        headers={**_headers(), "content-type": "application/json"},
    )
    payload = _payload()
    payload["cv"]["rawText"] = "sensitive forbidden text"
    unknown = _client().post(
        "/internal/v3/recommendations",
        json=payload,
        headers=_headers(),
    )

    for response in (malformed, unknown):
        assert response.status_code == 422
        assert response.json() == VALIDATION_BODY
        assert "detail" not in response.json()
        assert "sensitive" not in response.text
    assert calls == []


def test_unexpected_v3_failure_is_sanitized_and_not_logged(
    monkeypatch,
    caplog,
) -> None:
    secret = "sensitive persisted CV and sklearn traceback"

    def fail(*_args, **_kwargs):
        raise RuntimeError(secret)

    monkeypatch.setattr(api_module, "recommend_students", fail)
    caplog.set_level(logging.INFO, logger="ai_service.request")
    response = _client().post(
        "/internal/v3/recommendations",
        json=_payload(),
        headers=_headers(),
    )

    assert response.status_code == 500
    assert response.json() == INTERNAL_BODY
    assert secret not in response.text
    assert secret not in " ".join(record.getMessage() for record in caplog.records)


def test_openapi_exposes_student_and_company_v3_without_v3_cv_parse() -> None:
    document = _client().get("/openapi.json").json()
    paths = document["paths"]
    operation = paths["/internal/v3/recommendations"]["post"]
    request_schema = operation["requestBody"]["content"]["application/json"]["schema"]

    assert "/internal/v3/candidate-rankings" in paths
    assert "/internal/v3/cv/parse" not in paths
    assert "post" in paths["/internal/v2/recommendations"]
    assert "post" in paths["/internal/v2/cv/parse"]
    assert set(request_schema) >= {"$ref"}
    assert set(operation["responses"]) >= {"200", "401", "422", "500"}
