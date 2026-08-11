"""Focused HTTP tests for Company Candidate Ranking V3."""

from dataclasses import replace
import json
import logging
import os

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

import main
import v3.api as api_module
from request_context import REQUEST_ID_HEADER, install_request_context_middleware
from v2.http_errors import install_v2_error_handlers
from v3.api import create_v3_router
from v3.candidate_ranking_schemas import CandidateRankingResponse
from v3.constants import ALGORITHM, PROCESSING_VERSION


TEST_INTERNAL_API_KEY = os.environ["AI_INTERNAL_API_KEY"]
TRANSPORT_REQUEST_ID = "candidate-ranking-v3.transport-42"
BUSINESS_REQUEST_ID = "e5887544-9785-4697-8345-74953da1c2a7"
VALIDATION_BODY = {
    "errorCode": "VALIDATION_ERROR",
    "message": "Request validation failed.",
}
UNAUTHORIZED_BODY = {
    "errorCode": "UNAUTHORIZED",
    "message": "Unauthorized internal request.",
}
CAPACITY_BODY = {
    "errorCode": "CANDIDATE_RANKING_CAPACITY_EXCEEDED",
    "message": "Candidate ranking request exceeds synchronous capacity.",
}
INTERNAL_BODY = {
    "errorCode": "INTERNAL_ERROR",
    "message": "Internal service error.",
}


def _payload(candidate_count: int = 1) -> dict:
    return {
        "requestId": BUSINESS_REQUEST_ID,
        "job": {
            "id": 10,
            "text": "TITLE:\nBackend Intern\nDESCRIPTION:\nBuild reliable software services.",
            "skills": ["java", "spring boot"],
        },
        "candidates": [
            {
                "applicationId": 300 + index,
                "cvId": 55 + index,
                "processedText": f"private persisted candidate text {index}",
                "skills": ["java", "spring boot"],
                "languageCode": "en",
                "languageConfidence": 1.0,
                "processingVersion": PROCESSING_VERSION,
            }
            for index in range(candidate_count)
        ],
        "threshold": 0.1,
        "primaryLimit": 20,
        "fallbackLimit": 20,
    }


def _response(request) -> CandidateRankingResponse:
    candidate = request.candidates[0]
    return CandidateRankingResponse.model_validate(
        {
            "requestId": request.requestId,
            "algorithm": ALGORITHM,
            "algorithmVersion": "bilingual-candidate-ranking-v3",
            "results": [
                {
                    "applicationId": candidate.applicationId,
                    "cvId": candidate.cvId,
                    "rankingTier": "PRIMARY",
                    "rankingScore": 0.72,
                    "overallScore": 0.72,
                    "textScore": 0.65,
                    "skillScore": 0.85,
                    "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                    "matchedSkills": ["java"],
                    "missingSkills": ["spring boot"],
                }
            ],
        }
    )


def _client(
    *,
    max_candidates: int = 3,
    max_bytes: int = 8_388_608,
) -> TestClient:
    runtime = replace(
        main.v2_runtime,
        max_candidate_ranking_candidates=max_candidates,
        max_candidate_ranking_request_bytes=max_bytes,
    )
    app = FastAPI()
    install_request_context_middleware(app)
    app.include_router(create_v3_router(runtime))
    install_v2_error_handlers(app)
    return TestClient(app, raise_server_exceptions=False)


def _headers(**extra: str) -> dict[str, str]:
    return {
        "X-Internal-Api-Key": TEST_INTERNAL_API_KEY,
        REQUEST_ID_HEADER: TRANSPORT_REQUEST_ID,
        **extra,
    }


def _assert_error(response, expected: dict) -> None:
    assert response.json() == expected
    assert response.headers[REQUEST_ID_HEADER] == TRANSPORT_REQUEST_ID


def test_valid_authenticated_request_calls_service_and_preserves_contract(
    monkeypatch,
) -> None:
    calls = []

    def fake_rank(request, *, catalog):
        calls.append((request, catalog))
        return _response(request)

    monkeypatch.setattr(api_module, "rank_candidate_request", fake_rank)
    response = _client().post(
        "/internal/v3/candidate-rankings",
        json=_payload(),
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == TRANSPORT_REQUEST_ID
    assert response.json() == {
        "requestId": BUSINESS_REQUEST_ID,
        "algorithm": "tfidf-cosine-hybrid",
        "algorithmVersion": "bilingual-candidate-ranking-v3",
        "results": [
            {
                "applicationId": 300,
                "cvId": 55,
                "rankingTier": "PRIMARY",
                "rankingScore": 0.72,
                "overallScore": 0.72,
                "textScore": 0.65,
                "skillScore": 0.85,
                "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                "matchedSkills": ["java"],
                "missingSkills": ["spring boot"],
            }
        ],
    }
    assert len(calls) == 1
    assert calls[0][0].candidates[0].processedText == _payload()["candidates"][0]["processedText"]


@pytest.mark.parametrize(
    "headers",
    [{}, {"X-Internal-Api-Key": ""}, {"X-Internal-Api-Key": "wrong-key"}],
)
def test_missing_or_wrong_api_key_is_rejected(headers: dict[str, str]) -> None:
    response = _client().post(
        "/internal/v3/candidate-rankings",
        json=_payload(),
        headers={REQUEST_ID_HEADER: TRANSPORT_REQUEST_ID, **headers},
    )

    assert response.status_code == 401
    _assert_error(response, UNAUTHORIZED_BODY)


def test_malformed_json_without_api_key_documents_authentication_precedence() -> None:
    response = _client().post(
        "/internal/v3/candidate-rankings",
        content=b'{"requestId":',
        headers={
            REQUEST_ID_HEADER: TRANSPORT_REQUEST_ID,
            "content-type": "application/json",
        },
    )

    # The established bounded Candidate endpoint authenticates before its
    # explicit raw-body parsing dependency.
    assert response.status_code == 401
    _assert_error(response, UNAUTHORIZED_BODY)


def test_malformed_unknown_and_wrong_content_type_are_sanitized(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(
        api_module,
        "rank_candidate_request",
        lambda *args, **kwargs: calls.append((args, kwargs)),
    )
    malformed = _client().post(
        "/internal/v3/candidate-rankings",
        content=b'{"requestId":',
        headers=_headers(**{"content-type": "application/json"}),
    )
    payload = _payload()
    payload["candidates"][0]["email"] = "private@example.com"
    unknown = _client().post(
        "/internal/v3/candidate-rankings",
        json=payload,
        headers=_headers(),
    )
    wrong_type = _client().post(
        "/internal/v3/candidate-rankings",
        content=json.dumps(_payload()).encode(),
        headers=_headers(**{"content-type": "text/plain"}),
    )

    for response in (malformed, unknown, wrong_type):
        assert response.status_code == 422
        _assert_error(response, VALIDATION_BODY)
        assert "private" not in response.text
    assert calls == []


def test_raw_request_byte_capacity_is_checked_before_scoring(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(
        api_module,
        "rank_candidate_request",
        lambda request, **kwargs: (calls.append(request), _response(request))[1],
    )
    body = json.dumps(_payload(), ensure_ascii=False).encode("utf-8")

    accepted = _client(max_bytes=len(body)).post(
        "/internal/v3/candidate-rankings",
        content=body,
        headers=_headers(**{"content-type": "application/json"}),
    )
    rejected = _client(max_bytes=len(body) - 1).post(
        "/internal/v3/candidate-rankings",
        content=body,
        headers=_headers(**{"content-type": "application/json"}),
    )

    assert accepted.status_code == 200
    assert rejected.status_code == 413
    _assert_error(rejected, CAPACITY_BODY)
    assert len(calls) == 1


def test_candidate_count_capacity_is_runtime_only_and_never_truncates(
    monkeypatch,
) -> None:
    calls = []

    def fake_rank(request, *, catalog):
        calls.append(request)
        return _response(request)

    monkeypatch.setattr(api_module, "rank_candidate_request", fake_rank)
    accepted = _client(max_candidates=2).post(
        "/internal/v3/candidate-rankings",
        json=_payload(2),
        headers=_headers(),
    )
    rejected = _client(max_candidates=2).post(
        "/internal/v3/candidate-rankings",
        json=_payload(3),
        headers=_headers(),
    )

    assert accepted.status_code == 200
    assert len(calls[0].candidates) == 2
    assert rejected.status_code == 413
    _assert_error(rejected, CAPACITY_BODY)
    assert len(calls) == 1


def test_unexpected_failure_is_sanitized_without_candidate_text_logging(
    monkeypatch,
    caplog,
) -> None:
    secret = _payload()["candidates"][0]["processedText"]

    def fail(*_args, **_kwargs):
        raise RuntimeError(secret)

    monkeypatch.setattr(api_module, "rank_candidate_request", fail)
    caplog.set_level(logging.INFO, logger="ai_service.request")
    response = _client().post(
        "/internal/v3/candidate-rankings",
        json=_payload(),
        headers=_headers(),
    )

    assert response.status_code == 500
    _assert_error(response, INTERNAL_BODY)
    assert secret not in response.text
    assert secret not in " ".join(record.getMessage() for record in caplog.records)


def test_openapi_contains_both_v3_operations_and_no_v3_cv_parse() -> None:
    document = _client().get("/openapi.json").json()
    paths = document["paths"]
    operation = paths["/internal/v3/candidate-rankings"]["post"]
    request_schema = operation["requestBody"]["content"]["application/json"]["schema"]

    assert "/internal/v3/recommendations" in paths
    assert "/internal/v3/candidate-rankings" in paths
    assert "/internal/v3/cv/parse" not in paths
    assert set(request_schema["properties"]) == {
        "requestId",
        "job",
        "candidates",
        "threshold",
        "primaryLimit",
        "fallbackLimit",
    }
    assert request_schema["additionalProperties"] is False
    assert "$defs" not in request_schema
