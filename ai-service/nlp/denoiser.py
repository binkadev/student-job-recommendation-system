"""Stage 1: Deterministic regex denoising for PDF/DOCX English text.

Runs strictly BEFORE spaCy EntityRuler merging and POS/NER filtering:
1. Unicode NFC and whitespace/bullet normalization
2. Structured PII stripping (URLs, emails, phone numbers / long numeric IDs)
3. Shielding of technical punctuation tokens (C++, C#, .NET, Node.js, CI/CD,
   ASP.NET, Next.js, etc.) and CamelCase brand tokens (JavaScript, PostgreSQL,
   FastAPI, PyTorch, SpringBoot, ...)
4. Glued delimiter and CamelCase prose repair (e.g. "Java,SpringBoot" ->
   "Java , SpringBoot", "SoftwareEngineer" -> "Software Engineer")
"""

from __future__ import annotations

import re
import unicodedata


_URL_PATTERN = re.compile(
    r"(?<!\w)(?:https?://|ftp://|mailto:|www\.)\S+",
    flags=re.IGNORECASE,
)
_EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+(?![\w-])",
    flags=re.UNICODE,
)
# Phone numbers and long numeric identifiers (>= 7 digits across separators).
_PHONE_OR_ID_PATTERN = re.compile(
    r"(?<!\w)(?:\+?\d[\d\s().-]{6,}\d)(?!\w)"
)
_BULLET_AND_DASH_PATTERN = re.compile(r"[\u00a0\u200b\ufeff•▪◦●■◆▶►–—·]+")

# Multi-symbol technical tokens that must never be split by punctuation repair.
_PROTECTED_TECH_TOKENS = (
    "asp.net",
    "scikit-learn",
    "spring-boot",
    "express.js",
    "react.js",
    "node.js",
    "next.js",
    "nuxt.js",
    "vue.js",
    "ci/cd",
    "c++",
    "c#",
    ".net",
)
_PROTECTED_TECH_PATTERN = re.compile(
    r"(?<!\w)(?:"
    + "|".join(
        re.escape(token)
        for token in sorted(
            _PROTECTED_TECH_TOKENS,
            key=lambda item: (-len(item), item),
        )
    )
    + r")(?!\w)",
    flags=re.IGNORECASE,
)

# Known technical brand spellings whose internal CamelCase must be preserved.
_PROTECTED_BRAND_TOKENS = (
    "JavaScript",
    "TypeScript",
    "PostgreSQL",
    "MySQL",
    "SQLite",
    "NoSQL",
    "GraphQL",
    "FastAPI",
    "PyTorch",
    "TensorFlow",
    "MongoDB",
    "DynamoDB",
    "DevOps",
    "GitHub",
    "GitLab",
    "NextJS",
    "NodeJS",
    "ReactJS",
    "VueJS",
    "NuxtJS",
    "ExpressJS",
    "SpringBoot",
    "WebSocket",
    "RabbitMQ",
    "iOS",
    "jQuery",
    "gRPC",
    "SciKit",
)
_PROTECTED_BRAND_PATTERN = re.compile(
    r"(?<!\w)(?:"
    + "|".join(
        re.escape(token)
        for token in sorted(
            _PROTECTED_BRAND_TOKENS,
            key=lambda item: (-len(item), item),
        )
    )
    + r")(?!\w)",
    flags=re.IGNORECASE,
)

_GLUED_DELIMITER_PATTERN = re.compile(r"([,;|/:\(\)\[\]])")
_CAMEL_LOWER_TO_UPPER = re.compile(r"(?<=[a-z])(?=[A-Z])")
_CAMEL_ACRONYM_TO_WORD = re.compile(r"(?<=[A-Z])(?=[A-Z][a-z])")
_HORIZONTAL_SPACE_PATTERN = re.compile(r"[ \t]+")
_MULTI_NEWLINE_PATTERN = re.compile(r"\n{2,}")


def _strip_phone_if_long_digits(match: re.Match[str]) -> str:
    digits = sum(character.isdigit() for character in match.group(0))
    return " " if digits >= 7 else match.group(0)


def denoise_english_text(text: str) -> str:
    """Clean PDF/DOCX extraction artifacts and structured PII deterministically."""

    if not isinstance(text, str):
        raise TypeError("Denoising input must be a string")

    normalized = unicodedata.normalize(
        "NFC",
        text.replace("\r\n", "\n").replace("\r", "\n"),
    )
    cleaned = _BULLET_AND_DASH_PATTERN.sub(" ", normalized)
    cleaned = _URL_PATTERN.sub(" ", cleaned)
    cleaned = _EMAIL_PATTERN.sub(" ", cleaned)
    cleaned = _PHONE_OR_ID_PATTERN.sub(_strip_phone_if_long_digits, cleaned)

    # Shield protected technical tokens before delimiter/CamelCase repair.
    placeholders: dict[str, str] = {}
    prefix = "sjrtechshield"
    while prefix in cleaned.casefold():
        prefix += "x"

    def shield(match: re.Match[str]) -> str:
        key = f"{prefix}{len(placeholders):04d}"
        placeholders[key] = match.group(0)
        return f" {key} "

    cleaned = _PROTECTED_TECH_PATTERN.sub(shield, cleaned)
    cleaned = _PROTECTED_BRAND_PATTERN.sub(shield, cleaned)

    # Repair glued delimiters ("Java,SpringBoot" -> "Java , SpringBoot").
    cleaned = _GLUED_DELIMITER_PATTERN.sub(r" \1 ", cleaned)

    # Repair glued CamelCase prose ("SoftwareEngineer" -> "Software Engineer").
    cleaned = _CAMEL_LOWER_TO_UPPER.sub(" ", cleaned)
    cleaned = _CAMEL_ACRONYM_TO_WORD.sub(" ", cleaned)

    # Restore shielded tokens with clean boundary whitespace.
    for key, original in placeholders.items():
        cleaned = cleaned.replace(key, f" {original} ")

    lines = [
        _HORIZONTAL_SPACE_PATTERN.sub(" ", line).strip()
        for line in cleaned.split("\n")
    ]
    joined = "\n".join(line for line in lines if line)
    return _MULTI_NEWLINE_PATTERN.sub("\n", joined).strip()


__all__ = ["denoise_english_text"]
