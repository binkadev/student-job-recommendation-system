"""Deterministic parsing of the fixed Backend Job document format."""

from dataclasses import dataclass
import re
from typing import Literal


JobSectionName = Literal[
    "preamble",
    "title",
    "description",
    "requirements",
    "skills",
]

_HEADING_PATTERN = re.compile(
    r"^(title|description|requirements|skills)\s*:?\s*$",
    flags=re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class JobSection:
    """One section occurrence in source order."""

    name: JobSectionName
    body: str


@dataclass(frozen=True, slots=True)
class JobDocument:
    """Parsed Job text with SKILLS content excluded from lexical inputs."""

    sections: tuple[JobSection, ...]
    similarity_text: str
    language_evidence_text: str


def _normalize_line_endings(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def _join_retained_bodies(sections: tuple[JobSection, ...]) -> str:
    retained_bodies = [
        section.body
        for section in sections
        if section.name != "skills" and section.body.strip()
    ]
    return "\n".join(retained_bodies).strip()


def parse_job_document(text: str) -> JobDocument:
    """Parse supported full-line headings and exclude every SKILLS body.

    A heading is recognized only when the complete trimmed line is TITLE,
    DESCRIPTION, REQUIREMENTS, or SKILLS, optionally followed by a colon.
    Section occurrences stay in encounter order. Text before the first heading
    is represented as a preamble, and text with no recognized headings is
    treated entirely as unstructured preamble content.
    """

    if not isinstance(text, str):
        raise TypeError("Job document text must be a string")

    normalized = _normalize_line_endings(text)
    sections: list[JobSection] = []
    body_lines: list[str] = []
    current_name: JobSectionName = "preamble"
    recognized_heading = False

    def flush_section(*, force: bool = False) -> None:
        if body_lines or force:
            sections.append(JobSection(current_name, "\n".join(body_lines)))
        body_lines.clear()

    for line in normalized.split("\n"):
        heading_match = _HEADING_PATTERN.fullmatch(line.strip())
        if heading_match is None:
            body_lines.append(line)
            continue

        if recognized_heading or body_lines:
            flush_section(force=recognized_heading)

        recognized_heading = True
        current_name = heading_match.group(1).casefold()  # type: ignore[assignment]

    flush_section(force=recognized_heading)

    if not sections:
        sections.append(JobSection("preamble", normalized))

    immutable_sections = tuple(sections)
    similarity_text = _join_retained_bodies(immutable_sections)
    return JobDocument(
        sections=immutable_sections,
        similarity_text=similarity_text,
        language_evidence_text=similarity_text,
    )
