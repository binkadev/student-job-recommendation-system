"""Focused HTTP-boundary tests for the candidate-ranking V2 endpoint."""

from __future__ import annotations

from dataclasses import replace
import json
import logging
import os

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

import main
import v2.api as api_module
from request_context import REQUEST_ID_HEADER, install_request_context_middleware
from v2.candidate_ranking_schemas import (
    CandidateRankingResponse,
    CandidateRankingResult,
)
from v2.constants import ALGORITHM, CANDIDATE_RANKING_ALGORITHM_VERSION
from v2.http_errors import install_v2_error_handlers
from v2.api import create_v2_router
from v2.schemas import ScoringStrategy


TEST_INTERNAL_API_KEY = os.environ["AI_INTERNAL_API_KEY"]
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
TRANSPORT_REQUEST_ID = "candidate-ranking.transport-42"
BUSINESS_REQUEST_ID = "e5887544-9785-4697-8345-74953da1c2a7"


def _payload(candidate_count: int = 1) -> dict:
    return {
        "requestId": BUSINESS_REQUEST_ID,
        "job": {
            "id": 10,
            "text": "TITLE:\nBackend Intern\n\nDESCRIPTION:\nBuild APIs.",
            "skills": ["java", "spring boot"],
        },
        "candidates": [
            {
                "applicationId": 300 + index,
                "cvId": 55 + index,
                "text": "Java Spring Boot candidate text.",
                "skills": ["java", "spring boot"],
            }
            for index in range(candidate_count)
        ],
        "threshold": 0.1,
        "limit": 20,
    }


def _response(request) -> CandidateRankingResponse:
    candidate = request.candidates[0]
    return CandidateRankingResponse(
        requestId=request.requestId,
        algorithm=ALGORITHM,
        algorithmVersion=CANDIDATE_RANKING_ALGORITHM_VERSION,
        results=[
            CandidateRankingResult(
                applicationId=candidate.applicationId,
                cvId=candidate.cvId,
                score=0.72,
                textScore=0.65,
                skillScore=0.85,
                scoringStrategy=ScoringStrategy.SAME_LANGUAGE_HYBRID,
                matchedSkills=["java"],
                missingSkills=["spring boot"],
            )
        ],
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
    app.include_router(create_v2_router(runtime))
    install_v2_error_handlers(app)
    return TestClient(app, raise_server_exceptions=False)


def _headers(**extra: str) -> dict[str, str]:
    return {
        "X-Internal-Api-Key": TEST_INTERNAL_API_KEY,
        REQUEST_ID_HEADER: TRANSPORT_REQUEST_ID,
        **extra,
    }


def _assert_error(response, expected: dict) -> None:
    assert set(response.json()) == {"errorCode", "message"}
    assert response.json() == expected
    assert response.headers[REQUEST_ID_HEADER] == TRANSPORT_REQUEST_ID


def test_valid_backend_request_calls_service_once_and_preserves_contract(
    monkeypatch,
) -> None:
    calls = []

    def fake_rank(request, *, catalog):
        calls.append((request, catalog))
        return _response(request)

    monkeypatch.setattr(api_module, "rank_candidate_request", fake_rank)

    response = _client().post(
        "/internal/v2/candidate-rankings",
        json=_payload(),
        headers=_headers(),
    )

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == TRANSPORT_REQUEST_ID
    assert response.json() == {
        "requestId": BUSINESS_REQUEST_ID,
        "algorithm": "tfidf-cosine-hybrid",
        "algorithmVersion": "bilingual-candidate-ranking-v2",
        "results": [
            {
                "applicationId": 300,
                "cvId": 55,
                "score": 0.72,
                "textScore": 0.65,
                "skillScore": 0.85,
                "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                "matchedSkills": ["java"],
                "missingSkills": ["spring boot"],
            }
        ],
    }
    assert len(calls) == 1
    assert calls[0][0].requestId.hex == BUSINESS_REQUEST_ID.replace("-", "")
    assert set(response.json()) == {
        "requestId",
        "algorithm",
        "algorithmVersion",
        "results",
    }
    assert set(response.json()["results"][0]) == {
        "applicationId",
        "cvId",
        "score",
        "textScore",
        "skillScore",
        "scoringStrategy",
        "matchedSkills",
        "missingSkills",
    }


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"X-Internal-Api-Key": ""},
        {"X-Internal-Api-Key": "wrong-internal-api-key"},
    ],
)
def test_missing_blank_and_wrong_keys_are_unauthorized_without_parsing(
    monkeypatch,
    headers: dict[str, str],
) -> None:
    def fail_parse(*_args, **_kwargs):
        raise AssertionError("unauthorized request was parsed")

    monkeypatch.setattr(api_module, "require_candidate_ranking_request", fail_parse)
    response = _client(max_bytes=1).post(
        "/internal/v2/candidate-rankings",
        content=b"not-json-and-oversized",
        headers={REQUEST_ID_HEADER: TRANSPORT_REQUEST_ID, **headers},
    )

    assert response.status_code == 401
    _assert_error(response, UNAUTHORIZED_BODY)


def test_validation_errors_are_sanitized_and_do_not_call_scoring(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(
        api_module,
        "rank_candidate_request",
        lambda *args, **kwargs: calls.append((args, kwargs)),
    )
    cases = [
        (b"", "application/json"),
        (b'{"requestId":', "application/json"),
        (b"payload", "text/plain"),
    ]
    invalid_payloads = [
        {**_payload(), "unexpected": "do not expose"},
        {**_payload(), "threshold": "not numeric"},
    ]
    for content, content_type in cases:
        response = _client().post(
            "/internal/v2/candidate-rankings",
            content=content,
            headers=_headers(**{"content-type": content_type}),
        )
        assert response.status_code == 422
        _assert_error(response, VALIDATION_BODY)
    for invalid in invalid_payloads:
        response = _client().post(
            "/internal/v2/candidate-rankings",
            json=invalid,
            headers=_headers(),
        )
        assert response.status_code == 422
        _assert_error(response, VALIDATION_BODY)
        assert "not expose" not in response.text
    assert calls == []


@pytest.mark.parametrize(
    "mutate",
    [
        lambda payload: payload.update({"unknown": "root secret"}),
        lambda payload: payload["job"].update({"unknown": "job secret"}),
        lambda payload: payload["candidates"][0].update({"unknown": "candidate secret"}),
        lambda payload: payload["candidates"].append(dict(payload["candidates"][0])),
    ],
)
def test_unknown_fields_and_duplicate_application_id_are_sanitized(
    mutate,
    monkeypatch,
) -> None:
    calls = []
    monkeypatch.setattr(
        api_module,
        "rank_candidate_request",
        lambda *args, **kwargs: calls.append(True),
    )
    payload = _payload()
    mutate(payload)

    response = _client().post(
        "/internal/v2/candidate-rankings",
        json=payload,
        headers=_headers(),
    )

    assert response.status_code == 422
    _assert_error(response, VALIDATION_BODY)
    assert "secret" not in response.text
    assert calls == []


def test_json_charset_is_accepted(monkeypatch) -> None:
    monkeypatch.setattr(
        api_module,
        "rank_candidate_request",
        lambda request, **kwargs: _response(request),
    )

    response = _client().post(
        "/internal/v2/candidate-rankings",
        content=json.dumps(_payload()).encode(),
        headers=_headers(**{"content-type": "application/json; charset=utf-8"}),
    )

    assert response.status_code == 200


def test_raw_byte_capacity_uses_actual_utf8_body_and_rejects_before_scoring(
    monkeypatch,
) -> None:
    calls = []
    monkeypatch.setattr(
        api_module,
        "rank_candidate_request",
        lambda request, **kwargs: (calls.append(True), _response(request))[1],
    )
    payload = _payload()
    payload["job"]["text"] = "Ứng viên backend"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    accepted = _client(max_bytes=len(body)).post(
        "/internal/v2/candidate-rankings",
        content=body,
        headers=_headers(**{"content-type": "application/json", "content-length": "1"}),
    )
    assert accepted.status_code == 200
    assert len(calls) == 1

    rejected = _client(max_bytes=len(body) - 1).post(
        "/internal/v2/candidate-rankings",
        content=body,
        headers=_headers(**{"content-type": "application/json", "content-length": "1"}),
    )
    assert rejected.status_code == 413
    _assert_error(rejected, CAPACITY_BODY)
    assert len(calls) == 1
    assert str(len(body)) not in rejected.text


def test_candidate_count_capacity_is_runtime_only_and_does_not_truncate(
    monkeypatch,
) -> None:
    calls = []

    def fake_rank(request, *, catalog):
        calls.append(request)
        return _response(request)

    monkeypatch.setattr(api_module, "rank_candidate_request", fake_rank)
    accepted = _client(max_candidates=2).post(
        "/internal/v2/candidate-rankings",
        json=_payload(2),
        headers=_headers(),
    )
    assert accepted.status_code == 200
    assert len(calls) == 1
    assert len(calls[0].candidates) == 2

    rejected = _client(max_candidates=2).post(
        "/internal/v2/candidate-rankings",
        json=_payload(3),
        headers=_headers(),
    )
    assert rejected.status_code == 413
    _assert_error(rejected, CAPACITY_BODY)
    assert len(calls) == 1
    assert "3" not in rejected.text


def test_unexpected_scoring_failure_is_sanitized_and_not_logged(
    monkeypatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    secret = "sensitive candidate text and sklearn traceback"

    def fail(*_args, **_kwargs):
        raise RuntimeError(secret)

    monkeypatch.setattr(api_module, "rank_candidate_request", fail)
    caplog.set_level(logging.INFO, logger="ai_service.request")
    response = _client().post(
        "/internal/v2/candidate-rankings",
        json=_payload(),
        headers=_headers(),
    )

    assert response.status_code == 500
    _assert_error(response, INTERNAL_BODY)
    assert secret not in response.text
    assert secret not in " ".join(record.getMessage() for record in caplog.records)


def test_openapi_documents_candidate_ranking_and_preserves_existing_v2_paths() -> None:
    document = _client().get("/openapi.json").json()
    paths = document["paths"]
    operation = paths["/internal/v2/candidate-rankings"]["post"]
    request_schema = operation["requestBody"]["content"]["application/json"]["schema"]

    def resolve_json_pointer(reference: str):
        assert reference.startswith("#/")
        value = document
        for token in reference[2:].split("/"):
            token = token.replace("~1", "/").replace("~0", "~")
            assert isinstance(value, dict)
            assert token in value
            value = value[token]
        return value

    def assert_operation_refs_resolve(value) -> None:
        if isinstance(value, dict):
            reference = value.get("$ref")
            if isinstance(reference, str) and reference.startswith("#/"):
                resolve_json_pointer(reference)
            for child in value.values():
                assert_operation_refs_resolve(child)
        elif isinstance(value, list):
            for child in value:
                assert_operation_refs_resolve(child)

    assert_operation_refs_resolve(operation)

    assert set(request_schema["properties"]) == {
        "requestId",
        "job",
        "candidates",
        "threshold",
        "limit",
    }
    assert request_schema["required"] == [
        "requestId",
        "job",
        "candidates",
        "threshold",
        "limit",
    ]
    assert request_schema["additionalProperties"] is False
    assert "$defs" not in request_schema
    job_schema = request_schema["properties"]["job"]
    candidate_schema = request_schema["properties"]["candidates"]["items"]
    assert set(job_schema["properties"]) == {"id", "text", "skills"}
    assert set(candidate_schema["properties"]) == {
        "applicationId",
        "cvId",
        "text",
        "skills",
    }
    assert job_schema["additionalProperties"] is False
    assert candidate_schema["additionalProperties"] is False

    response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert response_schema == {
        "$ref": "#/components/schemas/CandidateRankingResponse"
    }
    assert resolve_json_pointer(response_schema["$ref"]) == document["components"]["schemas"]["CandidateRankingResponse"]
    for status_code in ("401", "413", "422", "500"):
        error_schema = operation["responses"][status_code]["content"]["application/json"]["schema"]
        assert error_schema == {
            "$ref": "#/components/schemas/V2ErrorResponse"
        }
        assert resolve_json_pointer(error_schema["$ref"]) == document["components"]["schemas"]["V2ErrorResponse"]
    assert "/internal/v2/cv/parse" in paths
    assert "/internal/v2/recommendations" in paths
