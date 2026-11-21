"""Request tracing tests across public /health and protected /internal routes."""

from __future__ import annotations

import logging
import os
import re
from uuid import UUID

from fastapi.testclient import TestClient
import pytest

import main
from core.constants import PROCESSING_VERSION
from core.request_context import (
    REQUEST_ID_HEADER,
    get_request_id,
    resolve_request_id,
)


CLIENT = TestClient(main.app, raise_server_exceptions=False)
TEST_INTERNAL_API_KEY = os.environ["AI_INTERNAL_API_KEY"]
UNAUTHORIZED_BODY = {
    "errorCode": "UNAUTHORIZED",
    "message": "Unauthorized internal request.",
}
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-"
    r"[0-9a-f]{4}-[0-9a-f]{12}$"
)
HEALTH_BODY = {
    "status": "ok",
    "service": "job-recommendation-ai",
    "algorithm": "tfidf-cosine-hybrid",
    "recommendationVersion": "english-global-idf-recommendation-v1",
    "candidateRankingVersion": "english-global-idf-candidate-ranking-v1",
    "processingVersion": "english-spacy-v1-skills-v1",
    "nlpModelHash": main.runtime.spacy_pipeline.model_hash,
    "tfidfModelVersion": main.runtime.tfidf_artifact.model_version,
    "tfidfModelSource": main.runtime.tfidf_artifact.source_kind,
    "tfidfDocCount": main.runtime.tfidf_artifact.doc_count,
    "tfidfVocabSize": main.runtime.tfidf_artifact.vocab_size,
}


def _assert_generated_uuid(value: str, rejected_value: str | None = None) -> None:
    assert UUID_PATTERN.fullmatch(value)
    assert str(UUID(value)) == value
    assert value != rejected_value


def test_health_without_header_returns_generated_request_id() -> None:
    response = CLIENT.get("/health")

    assert response.status_code == 200
    assert response.json() == HEALTH_BODY
    _assert_generated_uuid(response.headers[REQUEST_ID_HEADER])


def test_valid_request_id_is_preserved_without_changing_body() -> None:
    supplied = "client.trace_ID:123-abc"

    response = CLIENT.get(
        "/health",
        headers={REQUEST_ID_HEADER: supplied},
    )

    assert response.headers[REQUEST_ID_HEADER] == supplied
    assert response.json() == HEALTH_BODY


@pytest.mark.parametrize(
    "supplied",
    [
        "",
        "   ",
        "contains space",
        "contains/slash",
        "a" * 129,
    ],
)
def test_invalid_http_request_id_is_replaced(supplied: str) -> None:
    response = CLIENT.get(
        "/health",
        headers={REQUEST_ID_HEADER: supplied},
    )

    _assert_generated_uuid(
        response.headers[REQUEST_ID_HEADER],
        rejected_value=supplied,
    )


@pytest.mark.parametrize(
    "supplied",
    [
        "unicode-\u0111",
        "line\rbreak",
        "line\nbreak",
        " leading",
        "trailing ",
    ],
)
def test_unicode_crlf_and_surrounding_spaces_are_rejected(
    supplied: str,
) -> None:
    _assert_generated_uuid(
        resolve_request_id(supplied),
        rejected_value=supplied,
    )


@pytest.mark.parametrize(
    "internal_headers",
    [
        {},
        {"X-Internal-Api-Key": "wrong-internal-api-key"},
    ],
)
def test_unauthorized_internal_response_has_request_id(
    internal_headers: dict[str, str],
) -> None:
    supplied = "unauthorized.trace-1"
    headers = {REQUEST_ID_HEADER: supplied, **internal_headers}

    response = CLIENT.post(
        "/internal/recommendations",
        json={},
        headers=headers,
    )

    assert response.status_code == 401
    assert response.headers[REQUEST_ID_HEADER] == supplied
    assert response.json() == UNAUTHORIZED_BODY


def test_valid_internal_request_preserves_behavior_and_trace_header() -> None:
    supplied = "internal.valid-trace:1"
    payload = {
        "requestId": "e5887544-9785-4697-8345-74953da1c2a7",
        "cv": {
            "id": 7,
            "processedText": "java backend developer",
            "skills": ["Java"],
            "languageCode": "en",
            "languageConfidence": 1.0,
            "processingVersion": PROCESSING_VERSION,
        },
        "jobs": [],
        "threshold": 0,
        "limit": 20,
    }

    response = CLIENT.post(
        "/internal/recommendations",
        json=payload,
        headers={
            REQUEST_ID_HEADER: supplied,
            "X-Internal-Api-Key": TEST_INTERNAL_API_KEY,
        },
    )

    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == supplied
    assert response.json() == {
        "requestId": payload["requestId"],
        "algorithm": "tfidf-cosine-hybrid",
        "algorithmVersion": "english-global-idf-recommendation-v1",
        "results": [],
    }


def test_sequential_requests_do_not_leak_context() -> None:
    first = CLIENT.get(
        "/health",
        headers={REQUEST_ID_HEADER: "sequential.first"},
    )
    assert get_request_id() is None
    second = CLIENT.get(
        "/health",
        headers={REQUEST_ID_HEADER: "sequential.second"},
    )

    assert first.headers[REQUEST_ID_HEADER] == "sequential.first"
    assert second.headers[REQUEST_ID_HEADER] == "sequential.second"
    assert get_request_id() is None


def test_completion_log_excludes_query_string(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="ai_service.request")

    response = CLIENT.get(
        "/health?password=must-not-be-logged",
        headers={REQUEST_ID_HEADER: "safe.log-trace"},
    )

    assert response.status_code == 200
    messages = [
        record.getMessage()
        for record in caplog.records
        if record.name == "ai_service.request"
    ]
    assert len(messages) == 1
    assert "requestId=safe.log-trace" in messages[0]
    assert "method=GET" in messages[0]
    assert "path=/health" in messages[0]
    assert "status=200" in messages[0]
    assert "password" not in messages[0]
