"""Direct FastAPI tests for the usable English V2 HTTP boundary."""

from __future__ import annotations

import os
from pathlib import Path
from types import MappingProxyType

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from starlette.requests import Request

import main
import v2.api as api_module
from v2.api import (
    V2ConfigurationError,
    V2Runtime,
    build_v2_runtime,
    create_v2_router,
)
from v2.cv_service import CvParsingService
from v2.http_errors import install_v2_error_handlers
from v2.skill_canonicalizer import SkillCatalog
from v2.skill_extractor import SkillExtractor


FIXTURES = Path(__file__).resolve().parent / "fixtures"
TEST_INTERNAL_API_KEY = os.environ["AI_INTERNAL_API_KEY"]
AUTH_HEADERS = {"X-Internal-Api-Key": TEST_INTERNAL_API_KEY}
CLIENT = TestClient(
    main.app,
    headers=AUTH_HEADERS,
    raise_server_exceptions=False,
)
VALIDATION_BODY = {
    "errorCode": "VALIDATION_ERROR",
    "message": "Request validation failed.",
}
UNAUTHORIZED_BODY = {
    "errorCode": "UNAUTHORIZED",
    "message": "Unauthorized internal request.",
}
REQUEST_ID = "e5887544-9785-4697-8345-74953da1c2a7"
ENGLISH_CV_TEXT = (
    "Software Engineer\n"
    "Java, Spring Boot, PostgreSQL\n"
    "Developed REST APIs and microservices\n"
    "Built CI/CD pipelines\n"
    "3 years experience"
)
ENGLISH_JOB_TEXT = (
    "TITLE:\n"
    "Backend Developer\n"
    "DESCRIPTION:\n"
    "Build REST APIs and microservices for reliable software projects.\n"
    "REQUIREMENTS:\n"
    "Java, Spring Boot, PostgreSQL and development experience.\n"
    "SKILLS:\n"
    "Java\n"
    "Spring Boot\n"
    "PostgreSQL"
)


def _recommendation_payload() -> dict:
    return {
        "requestId": REQUEST_ID,
        "cv": {
            "id": 7,
            "text": ENGLISH_CV_TEXT,
            "skills": ["Java", "Spring Boot", "Postgres"],
        },
        "jobs": [
            {
                "id": 11,
                "text": ENGLISH_JOB_TEXT,
                "skills": ["java", "springboot", "postgresql"],
            }
        ],
        "threshold": 0,
        "limit": 20,
    }


def _assert_validation(response) -> None:
    assert response.status_code == 422
    assert response.json() == VALIDATION_BODY
    assert "detail" not in response.json()


def test_health_and_openapi_advertise_both_v2_routes() -> None:
    public_client = TestClient(main.app, raise_server_exceptions=False)
    health = public_client.get("/health")
    paths = public_client.get("/openapi.json").json()["paths"]
    multipart_schema = paths["/internal/v2/cv/parse"]["post"][
        "requestBody"
    ]["content"]["multipart/form-data"]["schema"]

    assert health.status_code == 200
    assert health.json() == {
        "status": "ok",
        "service": "job-recommendation-ai",
        "version": "tfidf-cosine-v1",
        "supportedContracts": ["v1", "v2"],
        "recommendationVersion": "bilingual-recommendation-v2",
        "processingVersion": "bilingual-nlp-v2-skills-v1",
    }
    assert "post" in paths["/internal/v2/cv/parse"]
    assert "post" in paths["/internal/v2/recommendations"]
    assert "401" in paths["/internal/v2/cv/parse"]["post"]["responses"]
    assert "401" in paths["/internal/v2/recommendations"]["post"]["responses"]
    assert multipart_schema == {
        "type": "object",
        "required": ["file"],
        "properties": {
            "file": {
                "type": "string",
                "format": "binary",
            }
        },
    }


def test_v2_request_without_internal_api_key_is_unauthorized() -> None:
    client = TestClient(main.app, raise_server_exceptions=False)

    response = client.post("/internal/v2/recommendations", json={})

    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY
    assert TEST_INTERNAL_API_KEY not in response.text


@pytest.mark.parametrize("provided_key", ["", "wrong-internal-api-key"])
def test_v2_request_with_invalid_internal_api_key_is_unauthorized(
    provided_key: str,
) -> None:
    response = CLIENT.post(
        "/internal/v2/recommendations",
        json={},
        headers={"X-Internal-Api-Key": provided_key},
    )

    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY
    assert TEST_INTERNAL_API_KEY not in response.text


@pytest.mark.parametrize(
    ("content", "content_type"),
    [
        (b"", "application/json"),
        (b"payload", "application/octet-stream"),
        (b"payload", "text/plain"),
    ],
)
def test_non_multipart_cv_requests_are_sanitized(
    content: bytes,
    content_type: str,
) -> None:
    _assert_validation(
        CLIENT.post(
            "/internal/v2/cv/parse",
            content=content,
            headers={"content-type": content_type},
        )
    )


def test_missing_file_field_is_sanitized() -> None:
    _assert_validation(
        CLIENT.post(
            "/internal/v2/cv/parse",
            files={"other": ("resume.pdf", b"pdf", "application/pdf")},
        )
    )


@pytest.mark.parametrize(
    ("content_type", "body"),
    [
        ("multipart/form-data", b"no boundary"),
        ("multipart/form-data; boundary=", b"empty boundary"),
        (
            "multipart/form-data; boundary=broken",
            b"--different\r\nContent-Disposition: form-data; "
            b'name="file"; filename="resume.pdf"\r\n\r\nbad',
        ),
        (
            "multipart/form-data; boundary=truncated",
            b"--truncated\r\nContent-Disposition: form-data; "
            b'name="file"; filename="resume.pdf"\r\n'
            b"Content-Type: application/pdf\r\n\r\n%PDF",
        ),
    ],
)
def test_malformed_multipart_is_sanitized(
    content_type: str,
    body: bytes,
) -> None:
    _assert_validation(
        CLIENT.post(
            "/internal/v2/cv/parse",
            content=body,
            headers={"content-type": content_type},
        )
    )


def test_injected_multipart_parser_failure_is_sanitized(
    monkeypatch,
) -> None:
    async def fail_form(_request):
        raise ValueError("sensitive multipart parser detail")

    monkeypatch.setattr(Request, "form", fail_form)

    response = CLIENT.post(
        "/internal/v2/cv/parse",
        content=b"--boundary--\r\n",
        headers={"content-type": "multipart/form-data; boundary=boundary"},
    )

    _assert_validation(response)
    assert "sensitive" not in response.text


def test_malformed_recommendation_json_is_sanitized() -> None:
    _assert_validation(
        CLIENT.post(
            "/internal/v2/recommendations",
            content=b'{"requestId":',
            headers={"content-type": "application/json"},
        )
    )


def test_pydantic_failure_and_duplicate_job_ids_are_sanitized() -> None:
    invalid = _recommendation_payload()
    invalid["unexpected"] = "must not leak"
    _assert_validation(
        CLIENT.post("/internal/v2/recommendations", json=invalid)
    )

    duplicate = _recommendation_payload()
    duplicate["jobs"].append(dict(duplicate["jobs"][0]))
    _assert_validation(
        CLIENT.post("/internal/v2/recommendations", json=duplicate)
    )


def test_v1_validation_body_remains_fastapi_default() -> None:
    response = CLIENT.post(
        "/internal/v1/recommendations",
        content=b"{",
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 422
    assert set(response.json()) == {"detail"}


@pytest.mark.parametrize(
    ("fixture_name", "mime"),
    [
        ("english_cv.pdf", "application/pdf"),
        (
            "english_cv.docx",
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document",
        ),
    ],
)
def test_real_english_cv_fixtures_parse_successfully(
    fixture_name: str,
    mime: str,
) -> None:
    fixture = FIXTURES / fixture_name
    response = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": (fixture_name, fixture.read_bytes(), mime)},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {
        "rawText",
        "processedText",
        "skills",
        "languageCode",
        "languageConfidence",
        "processingVersion",
        "warnings",
    }
    assert body["languageCode"] == "en"
    assert body["languageConfidence"] >= 0.65
    assert body["processedText"] == body["processedText"].strip()
    assert body["skills"] == sorted(body["skills"])
    assert {"java", "postgresql", "spring boot"} <= set(body["skills"])
    assert body["processingVersion"] == "bilingual-nlp-v2-skills-v1"


def test_direct_cv_route_preserves_raw_text_whitespace() -> None:
    raw_text = (
        "  Software Engineer\n"
        "Developed reliable software projects with Java experience.  "
    )
    cv_service = CvParsingService(
        max_file_size_bytes=10_000,
        skill_extractor=main.v2_runtime.skill_extractor,
        pdf_decoder=lambda _payload: raw_text,
    )
    runtime = V2Runtime(
        internal_api_key=TEST_INTERNAL_API_KEY,
        max_file_size_bytes=10_000,
        catalog=main.v2_runtime.catalog,
        skill_extractor=main.v2_runtime.skill_extractor,
        cv_service=cv_service,
    )
    app = FastAPI()
    install_v2_error_handlers(app)
    app.include_router(create_v2_router(runtime))
    client = TestClient(
        app,
        headers=AUTH_HEADERS,
        raise_server_exceptions=False,
    )

    response = client.post(
        "/internal/v2/cv/parse",
        files={"file": ("resume.pdf", b"pdf", "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["rawText"] == raw_text
    assert response.json()["processedText"] == (
        response.json()["processedText"].strip()
    )


def test_direct_cv_response_sorts_then_caps_200_extracted_skills() -> None:
    alias_map = {
        f"skill{index:03d}": f"skill{index:03d}"
        for index in range(205)
    }
    canonical_to_aliases = {
        value: (value,)
        for value in alias_map
    }
    catalog = SkillCatalog(
        catalog_version="skills-v1",
        canonical_skills=frozenset(alias_map),
        alias_to_canonical=MappingProxyType(alias_map),
        canonical_to_aliases=MappingProxyType(canonical_to_aliases),
    )
    extractor = SkillExtractor.from_catalog(catalog)
    raw_text = (
        "Software engineer developed reliable projects with experience. "
        + " ".join(reversed(tuple(alias_map)))
    )
    cv_service = CvParsingService(
        max_file_size_bytes=10_000,
        skill_extractor=extractor,
        pdf_decoder=lambda _payload: raw_text,
    )
    runtime = V2Runtime(
        internal_api_key=TEST_INTERNAL_API_KEY,
        max_file_size_bytes=10_000,
        catalog=catalog,
        skill_extractor=extractor,
        cv_service=cv_service,
    )
    app = FastAPI()
    install_v2_error_handlers(app)
    app.include_router(create_v2_router(runtime))
    client = TestClient(
        app,
        headers=AUTH_HEADERS,
        raise_server_exceptions=False,
    )

    response = client.post(
        "/internal/v2/cv/parse",
        files={"file": ("resume.pdf", b"pdf", "application/pdf")},
    )

    assert response.status_code == 200, response.text
    assert response.json()["skills"] == [
        f"skill{index:03d}"
        for index in range(200)
    ]


def test_empty_malformed_and_unsupported_files_use_safe_errors() -> None:
    empty = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    malformed_pdf = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": ("bad.pdf", b"not a pdf", "application/pdf")},
    )
    malformed_docx = CLIENT.post(
        "/internal/v2/cv/parse",
        files={
            "file": (
                "bad.docx",
                b"not a docx",
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document",
            )
        },
    )
    unsupported = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": ("resume.txt", b"text", "text/plain")},
    )

    assert empty.status_code == 400
    assert empty.json()["errorCode"] == "EMPTY_DOCUMENT"
    assert malformed_pdf.status_code == 400
    assert malformed_pdf.json()["errorCode"] == "DOCUMENT_EXTRACTION_FAILED"
    assert malformed_docx.status_code == 400
    assert malformed_docx.json()["errorCode"] == "DOCUMENT_EXTRACTION_FAILED"
    assert unsupported.status_code == 415
    assert unsupported.json()["errorCode"] == "UNSUPPORTED_FILE_TYPE"
    for response in (empty, malformed_pdf, malformed_docx, unsupported):
        assert set(response.json()) == {"errorCode", "message"}
        assert "not a" not in response.text


def test_recommendation_success_threshold_equality_and_no_rank_fields() -> None:
    payload = _recommendation_payload()
    initial = CLIENT.post("/internal/v2/recommendations", json=payload)

    assert initial.status_code == 200, initial.text
    initial_body = initial.json()
    assert initial_body["algorithm"] == "tfidf-cosine-hybrid"
    assert initial_body["algorithmVersion"] == "bilingual-recommendation-v2"
    assert len(initial_body["results"]) == 1
    public_score = initial_body["results"][0]["score"]

    payload["threshold"] = public_score
    equal = CLIENT.post("/internal/v2/recommendations", json=payload)
    payload["threshold"] = min(1, public_score + 0.00000001)
    higher = CLIENT.post("/internal/v2/recommendations", json=payload)

    assert len(equal.json()["results"]) == 1
    if public_score < 1:
        assert higher.json()["results"] == []
    for body in (initial_body, equal.json(), higher.json()):
        rendered = str(body)
        assert "rank" not in rendered
        assert "rankPosition" not in rendered


def test_vietnamese_job_uses_cross_language_strategy() -> None:
    payload = _recommendation_payload()
    payload["jobs"].append(
        {
            "id": 12,
            "text": "Kỹ sư phần mềm phát triển dự án và có kinh nghiệm.",
            "skills": ["Java"],
        }
    )

    response = CLIENT.post("/internal/v2/recommendations", json=payload)

    assert response.status_code == 200
    result = next(
        item for item in response.json()["results"] if item["jobId"] == 12
    )
    assert result["scoringStrategy"] == "CROSS_LANGUAGE_SKILL_BASED"
    assert result["textScore"] is None
    assert result["score"] == result["skillScore"]


def test_non_decoder_value_error_maps_to_generic_internal_error(
    monkeypatch,
) -> None:
    async def fail_parse(_self, _upload):
        raise ValueError(
            "C:\\private\\resume.pdf secret raw content dependency detail"
        )

    monkeypatch.setattr(CvParsingService, "parse_upload", fail_parse)

    response = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": ("resume.pdf", b"pdf", "application/pdf")},
    )

    assert response.status_code == 500
    assert response.json() == {
        "errorCode": "INTERNAL_ERROR",
        "message": "Internal service error.",
    }
    assert "private" not in response.text
    assert "secret" not in response.text


def test_recommendation_internal_failure_is_generic(
    monkeypatch,
) -> None:
    def fail_recommendation(*_args, **_kwargs):
        raise RuntimeError("sensitive sklearn and payload detail")

    monkeypatch.setattr(api_module, "recommend_english", fail_recommendation)

    response = CLIENT.post(
        "/internal/v2/recommendations",
        json=_recommendation_payload(),
    )

    assert response.status_code == 500
    assert response.json() == {
        "errorCode": "INTERNAL_ERROR",
        "message": "Internal service error.",
    }
    assert "sklearn" not in response.text


@pytest.mark.parametrize("value", ["", "0", "-1", "1.5", "abc", " 10"])
def test_invalid_max_file_size_fails_runtime_construction(
    value: str,
) -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.v2_runtime.catalog

    with pytest.raises(V2ConfigurationError, match="positive integer"):
        build_v2_runtime(
            environment={
                "AI_INTERNAL_API_KEY": TEST_INTERNAL_API_KEY,
                "AI_CV_MAX_FILE_SIZE_BYTES": value,
            },
            catalog_loader=catalog_loader,
        )

    assert catalog_loaded is False


def test_missing_internal_api_key_fails_before_catalog_load() -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.v2_runtime.catalog

    with pytest.raises(V2ConfigurationError, match="must be configured"):
        build_v2_runtime(environment={}, catalog_loader=catalog_loader)

    assert catalog_loaded is False


def test_short_internal_api_key_fails_before_catalog_load() -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.v2_runtime.catalog

    with pytest.raises(V2ConfigurationError, match="at least 32 characters"):
        build_v2_runtime(
            environment={"AI_INTERNAL_API_KEY": "too-short"},
            catalog_loader=catalog_loader,
        )

    assert catalog_loaded is False


@pytest.mark.parametrize(
    "value",
    [
        f" {TEST_INTERNAL_API_KEY}",
        f"{TEST_INTERNAL_API_KEY} ",
    ],
)
def test_internal_api_key_whitespace_fails_before_catalog_load(
    value: str,
) -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.v2_runtime.catalog

    with pytest.raises(V2ConfigurationError, match="whitespace"):
        build_v2_runtime(
            environment={"AI_INTERNAL_API_KEY": value},
            catalog_loader=catalog_loader,
        )

    assert catalog_loaded is False


def test_absent_max_file_size_uses_default_once() -> None:
    runtime = build_v2_runtime(
        environment={"AI_INTERNAL_API_KEY": TEST_INTERNAL_API_KEY},
        catalog_loader=lambda: main.v2_runtime.catalog,
    )

    assert runtime.max_file_size_bytes == 10_485_760
    assert runtime.cv_service.max_file_size_bytes == 10_485_760
