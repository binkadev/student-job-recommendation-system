"""Unit tests for the V2 single-read CV parsing service."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Awaitable, TypeVar

import pytest
from pdfminer.pdfparser import PDFSyntaxError

from v2.cv_service import CvParsingService, UploadedDocument
from v2.http_errors import V2ApiError
from v2.skill_canonicalizer import load_default_catalog
from v2.skill_extractor import SkillExtractor


ENGLISH_RAW_TEXT = (
    "  Software Engineer\n"
    "Java, Spring Boot, PostgreSQL\n"
    "Developed REST APIs and microservices\n"
    "Built CI/CD pipelines\n"
    "3 years experience  "
)
DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)
T = TypeVar("T")


def _run(awaitable: Awaitable[T]) -> T:
    return asyncio.run(awaitable)


@dataclass
class UploadSpy:
    payload: bytes
    filename: str = "resume.pdf"
    content_type: str = "application/pdf"
    read_error: Exception | None = None
    read_calls: list[int] | None = None
    close_calls: int = 0

    def __post_init__(self) -> None:
        self.read_calls = []

    async def read(self, size: int) -> bytes:
        assert self.read_calls is not None
        self.read_calls.append(size)
        if self.read_error is not None:
            raise self.read_error
        return self.payload[:size]

    async def close(self) -> None:
        self.close_calls += 1


@pytest.fixture()
def extractor() -> SkillExtractor:
    return SkillExtractor.from_catalog(load_default_catalog())


def _service(
    extractor: SkillExtractor,
    *,
    max_bytes: int = 1024,
    pdf_decoder=lambda _payload: ENGLISH_RAW_TEXT,
    docx_decoder=lambda _payload: ENGLISH_RAW_TEXT,
    docx_preflight=lambda _document: None,
) -> CvParsingService:
    return CvParsingService(
        max_file_size_bytes=max_bytes,
        skill_extractor=extractor,
        pdf_decoder=pdf_decoder,
        docx_decoder=docx_decoder,
        docx_preflight=docx_preflight,
    )


def test_upload_is_read_once_with_max_plus_one_and_closed(
    extractor: SkillExtractor,
) -> None:
    upload = UploadSpy(b"pdf payload")
    service = _service(extractor, max_bytes=32)

    response = _run(service.parse_upload(upload))  # type: ignore[arg-type]

    assert upload.read_calls == [33]
    assert upload.close_calls == 1
    assert response.rawText == ENGLISH_RAW_TEXT
    assert response.rawText.startswith("  ")
    assert response.rawText.endswith("  ")
    assert response.processedText == response.processedText.strip()


def test_same_immutable_bytes_are_preflighted_and_decoded(
    extractor: SkillExtractor,
) -> None:
    payload = b"one immutable docx payload"
    observed: list[bytes] = []

    def preflight(document: UploadedDocument) -> None:
        observed.append(document.payload)

    def decode(value: bytes) -> str:
        observed.append(value)
        return ENGLISH_RAW_TEXT

    service = _service(
        extractor,
        docx_preflight=preflight,
        docx_decoder=decode,
    )
    upload = UploadSpy(
        payload,
        filename="resume.docx",
        content_type=DOCX_MIME,
    )

    _run(service.parse_upload(upload))  # type: ignore[arg-type]

    assert len(observed) == 2
    assert observed[0] is observed[1]
    assert observed[0] == payload
    assert type(observed[0]) is bytes
    assert upload.read_calls == [1025]
    assert upload.close_calls == 1


def test_oversize_detection_reads_only_max_plus_one(
    extractor: SkillExtractor,
) -> None:
    decoder_called = False

    def decoder(_payload: bytes) -> str:
        nonlocal decoder_called
        decoder_called = True
        return ENGLISH_RAW_TEXT

    upload = UploadSpy(b"123456")
    service = _service(extractor, max_bytes=5, pdf_decoder=decoder)

    with pytest.raises(V2ApiError) as raised:
        _run(service.parse_upload(upload))  # type: ignore[arg-type]

    assert raised.value.status_code == 413
    assert raised.value.error_code == "DOCUMENT_TOO_LARGE"
    assert upload.read_calls == [6]
    assert upload.close_calls == 1
    assert decoder_called is False


def test_upload_closes_when_read_fails(
    extractor: SkillExtractor,
) -> None:
    failure = ValueError("read failure must remain internal")
    upload = UploadSpy(b"", read_error=failure)
    service = _service(extractor)

    with pytest.raises(ValueError, match="read failure"):
        _run(service.parse_upload(upload))  # type: ignore[arg-type]

    assert upload.read_calls == [1025]
    assert upload.close_calls == 1


def test_upload_closes_when_processing_fails(
    extractor: SkillExtractor,
) -> None:
    def unexpected(_payload: bytes) -> str:
        raise ValueError("non-decoder allowlist failure")

    upload = UploadSpy(b"pdf")
    service = _service(extractor, pdf_decoder=unexpected)

    with pytest.raises(ValueError, match="non-decoder"):
        _run(service.parse_upload(upload))  # type: ignore[arg-type]

    assert upload.close_calls == 1


def test_allowlisted_decoder_error_becomes_safe_extraction_error(
    extractor: SkillExtractor,
) -> None:
    def malformed(_payload: bytes) -> str:
        raise PDFSyntaxError("sensitive decoder detail")

    service = _service(extractor, pdf_decoder=malformed)

    with pytest.raises(V2ApiError) as raised:
        _run(service.parse_document(
            UploadedDocument("resume.pdf", "application/pdf", b"bad pdf")
        ))

    assert raised.value.status_code == 400
    assert raised.value.error_code == "DOCUMENT_EXTRACTION_FAILED"
    assert "sensitive" not in raised.value.public_message


def test_non_allowlisted_decoder_value_error_is_not_reclassified(
    extractor: SkillExtractor,
) -> None:
    def unexpected(_payload: bytes) -> str:
        raise ValueError("unexpected decoder value")

    service = _service(extractor, pdf_decoder=unexpected)

    with pytest.raises(ValueError, match="unexpected decoder value"):
        _run(service.parse_document(
            UploadedDocument("resume.pdf", "application/pdf", b"bad pdf")
        ))


def test_empty_and_whitespace_documents_are_rejected(
    extractor: SkillExtractor,
) -> None:
    service = _service(extractor, pdf_decoder=lambda _payload: " \n\t")

    with pytest.raises(V2ApiError) as empty_upload:
        _run(service.parse_document(
            UploadedDocument("resume.pdf", "application/pdf", b"")
        ))
    with pytest.raises(V2ApiError) as empty_text:
        _run(service.parse_document(
            UploadedDocument("resume.pdf", "application/pdf", b"pdf")
        ))

    assert empty_upload.value.error_code == "EMPTY_DOCUMENT"
    assert empty_text.value.error_code == "EMPTY_DOCUMENT"


def test_vietnamese_language_is_parsed(
    extractor: SkillExtractor,
) -> None:
    raw_text = "Kỹ sư phần mềm phát triển dự án và có kinh nghiệm với Java."
    service = _service(
        extractor,
        pdf_decoder=lambda _payload: raw_text,
    )

    response = _run(service.parse_document(
        UploadedDocument("resume.pdf", "application/pdf", b"pdf")
    ))

    assert response.rawText == raw_text
    assert response.languageCode.value == "vi"
    assert response.languageConfidence >= 0.65
    assert response.skills == ["java"]


@pytest.mark.parametrize(
    "raw_text",
    [
        (
            "Software Engineer developed REST APIs. "
            "Kỹ sư phần mềm phát triển dự án."
        ),
        "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD",
        "This is Java.",
    ],
)
def test_unsupported_language_is_rejected(
    extractor: SkillExtractor,
    raw_text: str,
) -> None:
    service = _service(
        extractor,
        pdf_decoder=lambda _payload: raw_text,
    )

    with pytest.raises(V2ApiError) as raised:
        _run(service.parse_document(
            UploadedDocument("resume.pdf", "application/pdf", b"pdf")
        ))

    assert raised.value.status_code == 422
    assert raised.value.error_code == "UNSUPPORTED_LANGUAGE"
    assert raised.value.public_message == (
        "English input with confidence of at least 0.65 is required."
    )


def test_no_skills_returns_stable_warning(
    extractor: SkillExtractor,
) -> None:
    raw_text = (
        "Software engineer developed and maintained reliable projects "
        "with broad responsibilities and qualifications."
    )
    service = _service(extractor, pdf_decoder=lambda _payload: raw_text)

    response = _run(service.parse_document(
        UploadedDocument("resume.pdf", "application/pdf", b"pdf")
    ))

    assert response.skills == []
    assert response.warnings == ["NO_CANONICAL_SKILLS_FOUND"]


def test_confident_english_with_blank_processed_text_is_rejected(
    extractor: SkillExtractor,
) -> None:
    service = _service(
        extractor,
        pdf_decoder=lambda _payload: "We are with our and we are with our.",
    )

    with pytest.raises(V2ApiError) as raised:
        _run(service.parse_document(
            UploadedDocument("resume.pdf", "application/pdf", b"pdf")
        ))

    assert raised.value.status_code == 422
    assert raised.value.error_code == "UNPROCESSABLE_DOCUMENT"


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("resume.txt", "text/plain"),
        ("resume.pdf", "text/plain"),
        ("resume", "application/pdf"),
    ],
)
def test_unsupported_file_metadata_is_rejected(
    extractor: SkillExtractor,
    filename: str,
    content_type: str,
) -> None:
    service = _service(extractor)

    with pytest.raises(V2ApiError) as raised:
        _run(service.parse_document(
            UploadedDocument(filename, content_type, b"payload")
        ))

    assert raised.value.status_code == 415
    assert raised.value.error_code == "UNSUPPORTED_FILE_TYPE"
