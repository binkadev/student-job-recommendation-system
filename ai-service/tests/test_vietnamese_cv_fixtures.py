"""Real decoder and V2 HTTP tests for deterministic Vietnamese fixtures."""

from hashlib import sha256
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import extractors
from main import app


FIXTURE_DIRECTORY = Path(__file__).parent / "fixtures"
RAW_TEXT = (
    "Kỹ sư phần mềm\n"
    "Có kinh nghiệm phát triển REST API và kiến trúc vi dịch vụ bằng\n"
    "Java, Spring Boot và PostgreSQL.\n"
    "Đã xây dựng quy trình CI/CD và triển khai ứng dụng bằng Docker.\n"
    "Ba năm kinh nghiệm phát triển hệ thống backend."
)
EXPECTED_SKILLS = [
    "ci/cd",
    "docker",
    "java",
    "microservices",
    "postgresql",
    "rest api",
    "spring boot",
]
FIXTURES = (
    (
        "vietnamese_cv.pdf",
        "application/pdf",
        "f0c1f81723c3d7bee6fb2ec9d3c8a4807c8e2030057cc62d8f52f097838b952f",
    ),
    (
        "vietnamese_cv.docx",
        "application/vnd.openxmlformats-officedocument."
        "wordprocessingml.document",
        "1c8be80cfde9485056a865e679a72c5babe3ade6c72a85417d4e0d2638310ffd",
    ),
)
CLIENT = TestClient(
    app,
    headers={"X-Internal-Api-Key": os.environ["AI_INTERNAL_API_KEY"]},
    raise_server_exceptions=False,
)


@pytest.mark.parametrize(("filename", "_mime", "expected_hash"), FIXTURES)
def test_real_vietnamese_fixture_decoder_and_hash(
    filename: str,
    _mime: str,
    expected_hash: str,
) -> None:
    path = FIXTURE_DIRECTORY / filename
    payload = path.read_bytes()
    decoder = (
        extractors.extract_from_pdf
        if path.suffix == ".pdf"
        else extractors.extract_from_docx
    )

    assert sha256(payload).hexdigest() == expected_hash
    assert decoder(payload) == RAW_TEXT


@pytest.mark.parametrize(("filename", "mime", "_expected_hash"), FIXTURES)
def test_v2_parses_real_vietnamese_fixture(
    filename: str,
    mime: str,
    _expected_hash: str,
) -> None:
    payload = (FIXTURE_DIRECTORY / filename).read_bytes()

    first = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": (filename, payload, mime)},
    )
    second = CLIENT.post(
        "/internal/v2/cv/parse",
        files={"file": (filename, payload, mime)},
    )

    assert first.status_code == 200, first.text
    assert first.json() == second.json()
    body = first.json()
    assert body["rawText"] == RAW_TEXT
    assert body["processedText"] == body["processedText"].strip()
    assert "kỹ_sư_phần_mềm" in body["processedText"].split()
    assert "kiến_trúc_vi_dịch_vụ" in body["processedText"].split()
    assert body["skills"] == EXPECTED_SKILLS
    assert body["languageCode"] == "vi"
    assert 0.65 <= body["languageConfidence"] <= 1.0
    assert body["processingVersion"] == "bilingual-nlp-v2-skills-v1"
    assert body["warnings"] == []
    assert set(body) == {
        "rawText",
        "processedText",
        "skills",
        "languageCode",
        "languageConfidence",
        "processingVersion",
        "warnings",
    }
