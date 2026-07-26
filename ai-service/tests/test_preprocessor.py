"""Tests for the English-only deterministic preprocessing pipeline."""

import ast
from dataclasses import FrozenInstanceError
import inspect

import pytest

import v2.constants as constants_module
import v2.job_document as job_document_module
import v2.language_detector as language_detector_module
import v2.preprocessor as preprocessor_module
import v2.skill_canonicalizer as skill_canonicalizer_module
from v2.language_detector import LanguageDetection
from v2.preprocessor import (
    UnsupportedLanguageError,
    preprocess_english,
    preprocess_english_job,
    tokenize_english,
)
from v2.schemas import LanguageCode


ENGLISH_CONTEXT = (
    "We are looking for engineers who will work with our team and build "
    "services for our users."
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


def test_preprocessing_normalizes_nfc_line_endings_case_and_whitespace() -> None:
    text = (
        f"{ENGLISH_CONTEXT}\r\n"
        "The RE\u0301SUME\u0301 describes APIs.\r"
        "THIS is useful."
    )

    result = preprocess_english(text)

    assert "résumé" in result.tokens
    assert "\n" not in result.processed_text
    assert "  " not in result.processed_text
    assert result.processed_text == " ".join(result.tokens)
    assert result.processed_text == result.processed_text.casefold()
    assert "the" not in result.tokens
    assert "this" not in result.tokens


def test_realistic_english_bullet_cv_preprocessing_succeeds() -> None:
    result = preprocess_english(ENGLISH_BULLET_CV)

    assert result.language.language_code is LanguageCode.ENGLISH
    assert result.language.confidence >= 0.65
    assert result.processed_text == (
        "software engineer java spring boot postgresql developed rest apis "
        "microservices built ci/cd pipelines 3 years experience"
    )


def test_structured_short_english_job_preprocessing_succeeds() -> None:
    result = preprocess_english_job(ENGLISH_STRUCTURED_JOB)

    assert result.language.language_code is LanguageCode.ENGLISH
    assert result.language.confidence >= 0.65
    assert result.processed_text == (
        "backend developer build rest apis microservices java spring boot "
        "postgresql"
    )


@pytest.mark.parametrize(
    "text",
    [
        ACCENTED_VIETNAMESE_RESUME,
        UNACCENTED_VIETNAMESE_RESUME,
    ],
)
def test_sparse_vietnamese_resume_preprocessing_is_rejected(
    text: str,
) -> None:
    with pytest.raises(UnsupportedLanguageError) as error:
        preprocess_english(text)

    assert error.value.language_code is LanguageCode.VIETNAMESE
    assert error.value.confidence >= 0.65


def test_mixed_resume_preprocessing_is_rejected_as_mixed() -> None:
    with pytest.raises(UnsupportedLanguageError) as error:
        preprocess_english(MIXED_RESUME)

    assert error.value.language_code is LanguageCode.MIXED


def test_urls_and_emails_are_removed_before_tokenization() -> None:
    result = preprocess_english(
        f"{ENGLISH_CONTEXT} Visit https://example.com/private-path, "
        "ftp://private.example/secret, or www.private.example. Email "
        "private.person@example.org, internal.person@intranet, or "
        "mailto:private.person@intranet. Also remove "
        "terminal.person@example.net. and terminal.person@intranet."
    )

    assert "https" not in result.tokens
    assert "example" not in result.tokens
    assert "com" not in result.tokens
    assert "private" not in result.tokens
    assert "person" not in result.tokens
    assert "org" not in result.tokens
    assert "ftp" not in result.tokens
    assert "secret" not in result.tokens
    assert "internal" not in result.tokens
    assert "intranet" not in result.tokens
    assert "mailto" not in result.tokens
    assert "terminal" not in result.tokens
    assert "net" not in result.tokens


def test_artifact_only_input_produces_no_tokens() -> None:
    assert tokenize_english(
        "ftp://the.and/with/our "
        "www.the-and.example "
        "the.and.with.our@internal "
        "mailto:the.and.with.our@internal "
        "the.and.with.our@example.com. "
        "the.and.with.our@intranet."
    ) == ()


def test_technical_tokens_and_single_letter_languages_are_preserved() -> None:
    text = (
        f"{ENGLISH_CONTEXT} We use C, R, C#, C++, .NET, ASP.NET, Node.js "
        "and CI/CD."
    )

    result = preprocess_english(text)

    for technical_token in (
        "c",
        "r",
        "c#",
        "c++",
        ".net",
        "asp.net",
        "node.js",
        "ci/cd",
    ):
        assert technical_token in result.tokens


def test_tokenizer_does_not_stem_or_lemmatize() -> None:
    tokens = tokenize_english("develop developed developing developers")

    assert tokens == ("develop", "developed", "developing", "developers")


@pytest.mark.parametrize(
    ("text", "expected_code"),
    [
        (
            "Chúng tôi đang tìm một lập trình viên có kinh nghiệm và làm "
            "việc với nhóm của chúng tôi.",
            LanguageCode.VIETNAMESE,
        ),
        (
            "We are hiring for our team and chúng tôi đang tìm một người làm "
            "việc với chúng tôi.",
            LanguageCode.MIXED,
        ),
        (TECHNOLOGY_ONLY_TEXT, LanguageCode.UNKNOWN),
    ],
)
def test_non_english_languages_are_rejected(
    text: str,
    expected_code: LanguageCode,
) -> None:
    with pytest.raises(UnsupportedLanguageError) as error:
        preprocess_english(text)

    assert error.value.language_code is expected_code


def test_low_confidence_english_is_rejected() -> None:
    with pytest.raises(UnsupportedLanguageError) as error:
        preprocess_english("This is Java.")

    assert error.value.language_code is LanguageCode.ENGLISH
    assert error.value.confidence < 0.65


@pytest.mark.parametrize(
    ("confidence", "accepted"),
    [
        (0.65, True),
        (0.64999999, False),
    ],
)
def test_confidence_threshold_accepts_exactly_point_six_five(
    monkeypatch,
    confidence: float,
    accepted: bool,
) -> None:
    detection = LanguageDetection(
        language_code=LanguageCode.ENGLISH,
        confidence=confidence,
        english_signal_count=4,
        vietnamese_signal_count=0,
    )
    monkeypatch.setattr(
        preprocessor_module,
        "detect_language",
        lambda _text: detection,
    )

    if accepted:
        assert preprocess_english("C++").processed_text == "c++"
    else:
        with pytest.raises(UnsupportedLanguageError):
            preprocess_english("C++")


def test_job_preprocessing_excludes_skills_and_heading_labels() -> None:
    source = (
        "TITLE:\n"
        "Backend Developer\n"
        "DESCRIPTION:\n"
        f"{ENGLISH_CONTEXT}\n"
        "SKILLS:\n"
        "C++ Node.js hidden-skill\n"
        "REQUIREMENTS:\n"
        "You will collaborate with our team."
    )

    result = preprocess_english_job(source)

    assert "title" not in result.tokens
    assert "description" not in result.tokens
    assert "skills" not in result.tokens
    assert "requirements" not in result.tokens
    assert "c++" not in result.tokens
    assert "node.js" not in result.tokens
    assert "hidden-skill" not in result.processed_text
    assert "backend" in result.tokens


def test_job_skills_cannot_supply_language_evidence() -> None:
    source = (
        "TITLE:\n"
        "Java Developer\n"
        "SKILLS:\n"
        "We are looking for a developer who will work with our team and "
        "build services for our users."
    )

    with pytest.raises(UnsupportedLanguageError) as error:
        preprocess_english_job(source)

    assert error.value.language_code is LanguageCode.UNKNOWN
    assert error.value.confidence == 0.0


def test_preprocessing_result_is_immutable() -> None:
    result = preprocess_english(ENGLISH_CONTEXT)

    with pytest.raises(FrozenInstanceError):
        result.processed_text = "changed"  # type: ignore[misc]


def test_underthesea_is_confined_to_the_vietnamese_preprocessor() -> None:
    non_tokenizer_modules = (
        constants_module,
        job_document_module,
        language_detector_module,
        skill_canonicalizer_module,
    )

    assert "from underthesea import word_tokenize" in inspect.getsource(
        preprocessor_module
    )
    for module in non_tokenizer_modules:
        source = inspect.getsource(module)
        assert "underthesea" not in source.casefold()

        syntax_tree = ast.parse(source)
        imported_names = {
            alias.name
            for node in ast.walk(syntax_tree)
            if isinstance(node, (ast.Import, ast.ImportFrom))
            for alias in node.names
        }
        assert all(
            not imported_name.startswith("underthesea")
            for imported_name in imported_names
        )


def test_preprocessor_rejects_non_string_input() -> None:
    with pytest.raises(TypeError, match="must be a string"):
        preprocess_english(None)  # type: ignore[arg-type]
