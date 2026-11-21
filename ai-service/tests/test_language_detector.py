"""Tests for the deterministic English-only language gate."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from core.constants import LANGUAGE_CONFIDENCE_THRESHOLD
from nlp.language_detector import (
    ENGLISH_RESUME_MARKER_PHRASES,
    ENGLISH_RESUME_MARKER_WORDS,
    ENGLISH_SIGNAL_WORDS,
    detect_job_language,
    detect_language,
)
from schemas.common import LanguageCode


def test_detects_confident_english_resume_and_job_prose() -> None:
    text = (
        "Software Engineer with experience developing backend services and "
        "REST APIs for users using Java, Spring Boot, and PostgreSQL."
    )
    detection = detect_language(text)

    assert detection.language_code is LanguageCode.ENGLISH
    assert detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
    assert detection.english_signal_count >= 6
    assert detection.non_english_signal_count == 0


def test_technical_skill_list_alone_is_unknown() -> None:
    detection = detect_language(
        "Java Spring Boot PostgreSQL Docker Kubernetes React TypeScript C++ C# .NET CI/CD"
    )

    assert detection.language_code is LanguageCode.UNKNOWN
    assert detection.confidence == 0.0


@pytest.mark.parametrize(
    "foreign_text",
    [
        "Nous developpons des services backend avec Java, Spring Boot et PostgreSQL pour nos utilisateurs.",
        "Wir entwickeln skalierbare Software mit Java, Spring Boot und PostgreSQL für unsere Kunden.",
        "Desarrollamos aplicaciones web con Java, Spring Boot y PostgreSQL para los usuarios.",
        "Kỹ sư phần mềm có kinh nghiệm phát triển REST API bằng Java và PostgreSQL.",
    ],
)
def test_rejects_non_english_documents_as_unknown(foreign_text: str) -> None:
    detection = detect_language(foreign_text)

    assert detection.language_code is not LanguageCode.ENGLISH
    assert detection.confidence < LANGUAGE_CONFIDENCE_THRESHOLD or detection.language_code is LanguageCode.MIXED


def test_detects_mixed_english_and_non_english_prose() -> None:
    mixed = (
        "Software Engineer with experience developing reliable backend services for users. "
        "Nous travaillons avec des equipes pour les projets dans notre entreprise."
    )
    detection = detect_language(mixed)

    assert detection.language_code is LanguageCode.MIXED
    assert detection.english_signal_count >= 2
    assert detection.non_english_signal_count >= 2


def test_ignores_urls_emails_and_numeric_ids() -> None:
    only_pii = (
        "https://example.com/the/and/for/with "
        "mailto:the.and.with@example.com 090123456789"
    )
    detection = detect_language(only_pii)

    assert detection.language_code is LanguageCode.UNKNOWN
    assert detection.confidence == 0.0


def test_detect_job_language_ignores_skills_section() -> None:
    job = (
        "TITLE:\nBackend Intern\n"
        "DESCRIPTION:\nWe develop reliable software services for our users.\n"
        "REQUIREMENTS:\nExperience with backend engineering projects.\n"
        "SKILLS:\navec pour dans nous vous sont les des\n"
    )
    detection = detect_job_language(job)

    assert detection.language_code is LanguageCode.ENGLISH
    assert detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD


def test_language_detection_is_immutable_and_validates_type() -> None:
    detection = detect_language("We build reliable software projects with our team.")
    with pytest.raises(FrozenInstanceError):
        detection.confidence = 0.0  # type: ignore[misc]
    with pytest.raises(TypeError, match="must be a string"):
        detect_language(None)  # type: ignore[arg-type]


def test_lexicon_constants_are_non_empty_frozensets() -> None:
    assert isinstance(ENGLISH_SIGNAL_WORDS, frozenset) and ENGLISH_SIGNAL_WORDS
    assert isinstance(ENGLISH_RESUME_MARKER_WORDS, frozenset) and ENGLISH_RESUME_MARKER_WORDS
    assert isinstance(ENGLISH_RESUME_MARKER_PHRASES, frozenset) and ENGLISH_RESUME_MARKER_PHRASES
