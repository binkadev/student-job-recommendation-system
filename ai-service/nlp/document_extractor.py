"""PDF/DOCX text extraction and DOCX archive safety preflight."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from zipfile import ZipFile, is_zipfile

import docx
import pdfplumber

from core.errors import document_extraction_error


_MAX_DOCX_ARCHIVE_MEMBERS = 2_048
_MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class UploadedDocument:
    """One immutable upload value shared by every CV validation stage."""

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


def extract_from_pdf(content: bytes) -> str:
    """Extract all text from a PDF byte stream, page by page."""

    text_pages: list[str] = []
    with pdfplumber.open(BytesIO(content)) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text_pages.append(extracted)
    return "\n".join(text_pages)


def extract_from_docx(content: bytes) -> str:
    """Extract all non-empty paragraph text from a DOCX byte stream."""

    document = docx.Document(BytesIO(content))
    paragraphs = [para.text for para in document.paragraphs if para.text.strip()]
    return "\n".join(paragraphs)
