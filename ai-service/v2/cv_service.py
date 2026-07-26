"""Safe single-read CV parsing for the English V2 baseline."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePath
from zipfile import BadZipFile, ZipFile, is_zipfile

from docx.opc.exceptions import PackageNotFoundError
from fastapi import UploadFile
from lxml.etree import XMLSyntaxError
from pdfminer.pdfparser import PDFSyntaxError
from pdfminer.psparser import PSSyntaxError
from pdfplumber.utils.exceptions import PdfminerException
from starlette.concurrency import run_in_threadpool

import extractors

from .constants import PROCESSING_VERSION
from .http_errors import (
    document_extraction_error,
    document_too_large_error,
    empty_document_error,
    unprocessable_document_error,
    unsupported_file_type_error,
    unsupported_language_error,
)
from .preprocessor import UnsupportedLanguageError, preprocess_english
from .schemas import CvParseResponse
from .skill_extractor import SkillExtractor


_MAX_RAW_TEXT_CHARACTERS = 1_000_000
_MAX_DOCX_ARCHIVE_MEMBERS = 2_048
_MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
_PDF_MIME = "application/pdf"
_DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)
_OCTET_STREAM_MIME = "application/octet-stream"
_SUPPORTED_MIME_TYPES = frozenset({_PDF_MIME, _DOCX_MIME, _OCTET_STREAM_MIME})
_MALFORMED_DECODER_EXCEPTIONS = (
    PDFSyntaxError,
    PSSyntaxError,
    PdfminerException,
    PackageNotFoundError,
    BadZipFile,
    XMLSyntaxError,
)


@dataclass(frozen=True, slots=True)
class UploadedDocument:
    """One immutable upload value shared by every V2 validation stage."""

    filename: str
    content_type: str
    payload: bytes


def preflight_docx(document: UploadedDocument) -> None:
    """Reject structurally unsafe DOCX archives before decoder invocation."""

    payload_stream = BytesIO(document.payload)
    if not is_zipfile(payload_stream):
        raise document_extraction_error()

    with ZipFile(BytesIO(document.payload)) as archive:
        members = archive.infolist()
        if len(members) > _MAX_DOCX_ARCHIVE_MEMBERS:
            raise document_extraction_error()
        if any(member.flag_bits & 0x1 for member in members):
            raise document_extraction_error()
        if (
            sum(member.file_size for member in members)
            > _MAX_DOCX_UNCOMPRESSED_BYTES
        ):
            raise document_extraction_error()


@dataclass(frozen=True, slots=True)
class CvParsingService:
    """Parse one upload without rereading its stream or leaking failures."""

    max_file_size_bytes: int
    skill_extractor: SkillExtractor
    pdf_decoder: Callable[[bytes], str] = extractors.extract_from_pdf
    docx_decoder: Callable[[bytes], str] = extractors.extract_from_docx
    docx_preflight: Callable[[UploadedDocument], None] = preflight_docx

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_file_size_bytes, bool)
            or not isinstance(self.max_file_size_bytes, int)
            or self.max_file_size_bytes <= 0
        ):
            raise ValueError("max_file_size_bytes must be a positive integer")
        if not isinstance(self.skill_extractor, SkillExtractor):
            raise TypeError("skill_extractor must be a SkillExtractor")

    async def parse_upload(self, upload: UploadFile) -> CvParseResponse:
        """Read one bounded payload, close the stream, and parse it."""

        try:
            payload = bytes(
                await upload.read(self.max_file_size_bytes + 1)
            )
            document = UploadedDocument(
                filename=upload.filename or "",
                content_type=upload.content_type or "",
                payload=payload,
            )
            return await self.parse_document(document)
        finally:
            await upload.close()

    async def parse_document(
        self,
        document: UploadedDocument,
    ) -> CvParseResponse:
        if not isinstance(document, UploadedDocument):
            raise TypeError("document must be an UploadedDocument")
        if len(document.payload) > self.max_file_size_bytes:
            raise document_too_large_error()

        suffix = self._validate_file_type(document)
        if not document.payload:
            raise empty_document_error()
        if suffix == ".docx":
            self.docx_preflight(document)

        raw_text = await run_in_threadpool(
            self._decode_document,
            document,
            suffix,
        )
        if not raw_text or raw_text.isspace():
            raise empty_document_error()
        if len(raw_text) > _MAX_RAW_TEXT_CHARACTERS:
            raise document_too_large_error()

        try:
            preprocessing = preprocess_english(raw_text)
        except UnsupportedLanguageError as error:
            raise unsupported_language_error() from error
        if not preprocessing.processed_text:
            raise unprocessable_document_error()

        skills = self.skill_extractor.extract(raw_text, limit=200)
        warnings = [] if skills else ["NO_CANONICAL_SKILLS_FOUND"]
        return CvParseResponse(
            rawText=raw_text,
            processedText=preprocessing.processed_text,
            skills=list(skills),
            languageCode=preprocessing.language.language_code,
            languageConfidence=preprocessing.language.confidence,
            processingVersion=PROCESSING_VERSION,
            warnings=warnings,
        )

    def _validate_file_type(self, document: UploadedDocument) -> str:
        suffix = PurePath(document.filename).suffix.casefold()
        if suffix not in {".pdf", ".docx"}:
            raise unsupported_file_type_error()

        content_type = document.content_type.strip().casefold()
        if content_type and content_type not in _SUPPORTED_MIME_TYPES:
            raise unsupported_file_type_error()
        return suffix

    def _decode_document(
        self,
        document: UploadedDocument,
        suffix: str,
    ) -> str:
        decoder = self.pdf_decoder if suffix == ".pdf" else self.docx_decoder
        try:
            return decoder(document.payload)
        except _MALFORMED_DECODER_EXCEPTIONS as error:
            raise document_extraction_error() from error
