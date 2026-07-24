import pdfplumber
import docx
from fastapi import UploadFile
import io


async def extract_text(file: UploadFile) -> str:
    """
    Extracts raw text from an uploaded PDF or DOCX file.

    Raises:
        ValueError: If the file extension is not .pdf or .docx.
    """
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".pdf"):
        return extract_from_pdf(content)
    elif filename.endswith(".docx"):
        return extract_from_docx(content)
    else:
        raise ValueError(
            f"Unsupported file type: '{file.filename}'. Only PDF and DOCX are accepted."
        )


def extract_from_pdf(content: bytes) -> str:
    """Extract all text from a PDF byte stream, page by page."""
    text_pages = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text_pages.append(extracted)
    return "\n".join(text_pages)


def extract_from_docx(content: bytes) -> str:
    """Extract all non-empty paragraph text from a DOCX byte stream."""
    doc = docx.Document(io.BytesIO(content))
    paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
    return "\n".join(paragraphs)
