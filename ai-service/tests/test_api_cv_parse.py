"""HTTP boundary tests for /health, OpenAPI, authentication, and POST /internal/cv/parse."""

from __future__ import annotations

import os
from pathlib import Path
from types import MappingProxyType

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from starlette.requests import Request

import main
from api.router import create_internal_router
from core.errors import install_error_handlers
from nlp.skill_canonicalizer import SkillCatalog
from nlp.skill_extractor import SkillExtractor
from services.cv_service import CvParsingService
from services.runtime import AppRuntime


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


def _assert_validation(response) -> None:
    assert response.status_code == 422
    assert response.json() == VALIDATION_BODY
    assert "detail" not in response.json()


def test_health_and_openapi_expose_only_unified_internal_routes() -> None:
    public_client = TestClient(main.app, raise_server_exceptions=False)
    health = public_client.get("/health")
    paths = public_client.get("/openapi.json").json()["paths"]
    multipart_schema = paths["/internal/cv/parse"]["post"][
        "requestBody"
    ]["content"]["multipart/form-data"]["schema"]

    assert health.status_code == 200
    health_body = health.json()
    assert health_body["status"] == "ok"
    assert health_body["service"] == "job-recommendation-ai"
    assert health_body["algorithm"] == "tfidf-cosine-hybrid"
    assert health_body["recommendationVersion"] == "english-global-idf-recommendation-v1"
    assert health_body["candidateRankingVersion"] == "english-global-idf-candidate-ranking-v1"
    assert health_body["processingVersion"] == "english-spacy-v1-skills-v1"
    assert health_body["nlpModelHash"] == main.runtime.spacy_pipeline.model_hash
    assert health_body["tfidfModelVersion"] == main.runtime.tfidf_artifact.model_version
    assert health_body["tfidfModelSource"] in {"mounted", "bootstrap"}
    assert health_body["tfidfDocCount"] >= 24
    assert health_body["tfidfVocabSize"] > 0
    assert set(paths) == {
        "/health",
        "/internal/cv/parse",
        "/internal/jobs/preprocess",
        "/internal/recommendations",
        "/internal/candidate-rankings",
    }
    assert "401" in paths["/internal/cv/parse"]["post"]["responses"]
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


@pytest.mark.parametrize(
    "legacy_path",
    [
        "/internal/v1/cv/parse",
        "/internal/v1/recommendations",
        "/internal/v2/cv/parse",
        "/internal/v2/recommendations",
        "/internal/v2/candidate-rankings",
        "/internal/v3/recommendations",
        "/internal/v3/candidate-rankings",
    ],
)
def test_removed_legacy_versioned_routes_return_404(legacy_path: str) -> None:
    response = CLIENT.post(legacy_path, json={})
    assert response.status_code == 404


def test_cv_parse_without_internal_api_key_is_unauthorized() -> None:
    client = TestClient(main.app, raise_server_exceptions=False)

    response = client.post("/internal/cv/parse")

    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY
    assert TEST_INTERNAL_API_KEY not in response.text


@pytest.mark.parametrize("provided_key", ["", "wrong-internal-api-key"])
def test_cv_parse_with_invalid_internal_api_key_is_unauthorized(
    provided_key: str,
) -> None:
    response = CLIENT.post(
        "/internal/cv/parse",
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
            "/internal/cv/parse",
            content=content,
            headers={"content-type": content_type},
        )
    )


def test_missing_file_field_is_sanitized() -> None:
    _assert_validation(
        CLIENT.post(
            "/internal/cv/parse",
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
            "/internal/cv/parse",
            content=body,
            headers={"content-type": content_type},
        )
    )


def test_injected_multipart_parser_failure_is_sanitized(monkeypatch) -> None:
    async def fail_form(_self: Request):
        raise RuntimeError("sensitive multipart parser detail")

    monkeypatch.setattr(Request, "form", fail_form)

    response = CLIENT.post(
        "/internal/cv/parse",
        content=b"--boundary\r\n--boundary--\r\n",
        headers={"content-type": "multipart/form-data; boundary=boundary"},
    )

    _assert_validation(response)
    assert "sensitive" not in response.text


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
        "/internal/cv/parse",
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
    assert body["processingVersion"] == "english-spacy-v1-skills-v1"


def test_direct_cv_route_preserves_raw_text_whitespace() -> None:
    raw_text = (
        "  Software Engineer\n"
        "Developed reliable software projects with Java experience.  "
    )
    cv_service = CvParsingService(
        max_file_size_bytes=10_000,
        skill_extractor=main.runtime.skill_extractor,
        spacy_pipeline=main.runtime.spacy_pipeline,
        pdf_decoder=lambda _payload: raw_text,
    )
    runtime = AppRuntime(
        internal_api_key=TEST_INTERNAL_API_KEY,
        max_file_size_bytes=10_000,
        catalog=main.runtime.catalog,
        skill_extractor=main.runtime.skill_extractor,
        spacy_pipeline=main.runtime.spacy_pipeline,
        tfidf_artifact=main.runtime.tfidf_artifact,
        cv_service=cv_service,
    )
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(create_internal_router(runtime))
    client = TestClient(
        app,
        headers=AUTH_HEADERS,
        raise_server_exceptions=False,
    )

    response = client.post(
        "/internal/cv/parse",
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
        spacy_pipeline=main.runtime.spacy_pipeline,
        pdf_decoder=lambda _payload: raw_text,
    )
    runtime = AppRuntime(
        internal_api_key=TEST_INTERNAL_API_KEY,
        max_file_size_bytes=10_000,
        catalog=catalog,
        skill_extractor=extractor,
        spacy_pipeline=main.runtime.spacy_pipeline,
        tfidf_artifact=main.runtime.tfidf_artifact,
        cv_service=cv_service,
    )
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(create_internal_router(runtime))
    client = TestClient(
        app,
        headers=AUTH_HEADERS,
        raise_server_exceptions=False,
    )

    response = client.post(
        "/internal/cv/parse",
        files={"file": ("resume.pdf", b"pdf", "application/pdf")},
    )

    assert response.status_code == 200, response.text
    assert response.json()["skills"] == [
        f"skill{index:03d}"
        for index in range(200)
    ]


def test_empty_malformed_and_unsupported_files_use_safe_errors() -> None:
    empty = CLIENT.post(
        "/internal/cv/parse",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    malformed_pdf = CLIENT.post(
        "/internal/cv/parse",
        files={"file": ("bad.pdf", b"not a pdf", "application/pdf")},
    )
    malformed_docx = CLIENT.post(
        "/internal/cv/parse",
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
        "/internal/cv/parse",
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


def test_non_decoder_value_error_maps_to_generic_internal_error(
    monkeypatch,
) -> None:
    async def fail_parse(_self, _upload):
        raise ValueError(
            "C:\\private\\resume.pdf secret raw content dependency detail"
        )

    monkeypatch.setattr(CvParsingService, "parse_upload", fail_parse)

    response = CLIENT.post(
        "/internal/cv/parse",
        files={"file": ("resume.pdf", b"pdf", "application/pdf")},
    )

    assert response.status_code == 500
    assert response.json() == {
        "errorCode": "INTERNAL_ERROR",
        "message": "Internal service error.",
    }
    assert "private" not in response.text
    assert "secret" not in response.text
