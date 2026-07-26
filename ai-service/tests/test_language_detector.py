"""Tests for deterministic fixed-lexicon language detection."""

import math

import pytest

from v2.language_detector import (
    ENGLISH_RESUME_MARKER_PHRASES,
    ENGLISH_RESUME_MARKER_WORDS,
    ENGLISH_SIGNAL_WORDS,
    VIETNAMESE_RESUME_MARKER_PHRASES,
    VIETNAMESE_SIGNAL_WORDS,
    LanguageDetection,
    detect_job_language,
    detect_language,
)
from v2.schemas import LanguageCode


ENGLISH_TEXT = (
    "We are looking for a developer who will work with our team and build "
    "services for our users."
)
VIETNAMESE_TEXT = (
    "Chúng tôi đang tìm một lập trình viên có kinh nghiệm và làm việc với "
    "nhóm của chúng tôi."
)
UNACCENTED_VIETNAMESE_TEXT = (
    "Chung toi dang tim kiem mot lap trinh vien co kinh nghiem va lam viec "
    "voi nhom cua chung toi."
)
MIXED_TEXT = (
    "We are hiring for our team and chúng tôi đang tìm một người làm việc "
    "với chúng tôi."
)
ENGLISH_BULLET_CV = (
    "Software Engineer\n"
    "Java, Spring Boot, PostgreSQL\n"
    "Developed REST APIs and microservices\n"
    "Built CI/CD pipelines\n"
    "3 years experience"
)
ENGLISH_STRUCTURED_JOB = (
    "TITLE:\n"
    "Backend Developer\n"
    "DESCRIPTION:\n"
    "Build REST APIs and microservices.\n"
    "REQUIREMENTS:\n"
    "Java, Spring Boot, PostgreSQL\n"
    "SKILLS:\n"
    "Java\n"
    "Spring Boot\n"
    "PostgreSQL"
)
ACCENTED_VIETNAMESE_RESUME = (
    "Kỹ sư phần mềm Java Spring Boot PostgreSQL"
)
UNACCENTED_VIETNAMESE_RESUME = (
    "Ky su phan mem Java Spring Boot PostgreSQL"
)
MIXED_RESUME = (
    "Software Engineer\n"
    "Developed REST APIs\n"
    "Kỹ sư phần mềm Java Spring Boot"
)
TECHNOLOGY_ONLY_TEXT = (
    "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD"
)
BROAD_TECHNOLOGY_ONLY_TEXT = (
    "IT Java JavaScript TypeScript React Spring Boot PostgreSQL Docker "
    "Kubernetes C R C# C++ .NET ASP.NET Node.js CI/CD"
)


@pytest.mark.parametrize(
    ("text", "expected_code"),
    [
        (ENGLISH_TEXT, LanguageCode.ENGLISH),
        (VIETNAMESE_TEXT, LanguageCode.VIETNAMESE),
        (UNACCENTED_VIETNAMESE_TEXT, LanguageCode.VIETNAMESE),
        (MIXED_TEXT, LanguageCode.MIXED),
        (TECHNOLOGY_ONLY_TEXT, LanguageCode.UNKNOWN),
        ("café résumé naïve façade", LanguageCode.UNKNOWN),
    ],
)
def test_detects_expected_language_with_finite_confidence(
    text: str,
    expected_code: LanguageCode,
) -> None:
    detection = detect_language(text)

    assert detection.language_code is expected_code
    assert math.isfinite(detection.confidence)
    assert 0.0 <= detection.confidence <= 1.0
    if expected_code is LanguageCode.UNKNOWN:
        assert detection.confidence == 0.0
    else:
        assert detection.confidence > 0.0


def test_rich_english_and_vietnamese_evidence_reach_confident_results() -> None:
    assert detect_language(ENGLISH_TEXT).confidence >= 0.65
    assert detect_language(VIETNAMESE_TEXT).confidence >= 0.65
    assert detect_language(UNACCENTED_VIETNAMESE_TEXT).confidence >= 0.65


def test_realistic_english_bullet_cv_is_confidently_english() -> None:
    assert detect_language(ENGLISH_BULLET_CV) == LanguageDetection(
        language_code=LanguageCode.ENGLISH,
        confidence=1.0,
        english_signal_count=9,
        vietnamese_signal_count=0,
    )


def test_structured_short_english_job_is_confident_after_pruning() -> None:
    assert detect_job_language(ENGLISH_STRUCTURED_JOB) == LanguageDetection(
        language_code=LanguageCode.ENGLISH,
        confidence=0.83333333,
        english_signal_count=5,
        vietnamese_signal_count=0,
    )


@pytest.mark.parametrize(
    "text",
    [
        ACCENTED_VIETNAMESE_RESUME,
        UNACCENTED_VIETNAMESE_RESUME,
    ],
)
def test_sparse_vietnamese_resumes_are_confidently_vietnamese(
    text: str,
) -> None:
    assert detect_language(text) == LanguageDetection(
        language_code=LanguageCode.VIETNAMESE,
        confidence=0.66666667,
        english_signal_count=0,
        vietnamese_signal_count=4,
    )


def test_mixed_resume_stays_mixed() -> None:
    assert detect_language(MIXED_RESUME) == LanguageDetection(
        language_code=LanguageCode.MIXED,
        confidence=1.0,
        english_signal_count=4,
        vietnamese_signal_count=4,
    )


@pytest.mark.parametrize(
    "text",
    [
        TECHNOLOGY_ONLY_TEXT,
        BROAD_TECHNOLOGY_ONLY_TEXT,
    ],
)
def test_technical_terms_are_language_neutral(text: str) -> None:
    detection = detect_language(text)

    assert detection == LanguageDetection(
        language_code=LanguageCode.UNKNOWN,
        confidence=0.0,
        english_signal_count=0,
        vietnamese_signal_count=0,
    )


def test_urls_emails_and_long_identifiers_are_neutral() -> None:
    baseline = detect_language("Java Spring Boot")
    noisy = detect_language(
        "Java Spring Boot https://the.and/with/our "
        "ftp://the.and/with/our www.the-and.example "
        "the.and.with.our@example.com the.and.with.our@internal "
        "the.and.with.our@example.net. the.and.with.our@intranet. "
        "mailto:the.and.with.our@internal "
        "123456789012 123-456-789"
    )

    assert noisy == baseline


def test_repeated_signal_words_do_not_inflate_distinct_lexicon_evidence() -> None:
    once = detect_language("the and")
    repeated = detect_language("the the the and and and")
    resume_once = detect_language("software engineer")
    resume_repeated = detect_language(
        "software engineer software engineer software engineer"
    )
    vietnamese_once = detect_language("kỹ sư phần mềm")
    vietnamese_repeated = detect_language(
        "kỹ sư phần mềm kỹ sư phần mềm kỹ sư phần mềm"
    )

    assert repeated == once
    assert resume_repeated == resume_once
    assert vietnamese_repeated == vietnamese_once


def test_vietnamese_resume_phrases_require_contiguous_ordered_tokens() -> None:
    detection = detect_language(
        "kysu phanmem su ky mem phan Java Spring Boot"
    )

    assert detection == LanguageDetection(
        language_code=LanguageCode.UNKNOWN,
        confidence=0.0,
        english_signal_count=0,
        vietnamese_signal_count=0,
    )


@pytest.mark.parametrize(
    "text",
    [
        "Software Engineer",
        "Software Development",
        "Engineer Developer",
    ],
)
def test_domain_or_role_nouns_alone_are_not_confident_english(
    text: str,
) -> None:
    detection = detect_language(text)

    assert detection.confidence < 0.65


def test_job_detection_excludes_headings_and_complete_skills_body() -> None:
    source = (
        "TITLE:\n"
        "Backend Developer\n"
        "DESCRIPTION:\n"
        f"{ENGLISH_TEXT}\n"
        "SKILLS:\n"
        f"{VIETNAMESE_TEXT}\n"
        "and the with our\n"
        "REQUIREMENTS:\n"
        "You will work with our team."
    )

    pruned_detection = detect_job_language(source)
    unpruned_detection = detect_language(source)

    assert pruned_detection.language_code is LanguageCode.ENGLISH
    assert pruned_detection.confidence >= 0.65
    assert unpruned_detection.language_code is LanguageCode.MIXED


def test_signal_lexicons_are_fixed_immutable_and_non_overlapping() -> None:
    assert isinstance(ENGLISH_SIGNAL_WORDS, frozenset)
    assert isinstance(ENGLISH_RESUME_MARKER_WORDS, frozenset)
    assert isinstance(ENGLISH_RESUME_MARKER_PHRASES, frozenset)
    assert isinstance(VIETNAMESE_SIGNAL_WORDS, frozenset)
    assert isinstance(VIETNAMESE_RESUME_MARKER_PHRASES, frozenset)
    assert ENGLISH_SIGNAL_WORDS.isdisjoint(VIETNAMESE_SIGNAL_WORDS)
    assert ENGLISH_SIGNAL_WORDS.isdisjoint(ENGLISH_RESUME_MARKER_WORDS)


def test_detection_is_repeatable() -> None:
    first = detect_language(MIXED_TEXT)
    assert all(detect_language(MIXED_TEXT) == first for _ in range(10))


def test_detection_rejects_non_string_input() -> None:
    with pytest.raises(TypeError, match="must be a string"):
        detect_language(None)  # type: ignore[arg-type]
