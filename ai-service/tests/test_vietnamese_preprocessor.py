"""Focused tests for the locked deterministic Vietnamese pipeline."""

import unicodedata

import pytest

from v2.preprocessor import (
    preprocess_english,
    preprocess_vietnamese,
    preprocess_vietnamese_job,
    tokenize_vietnamese,
)
from v2.schemas import LanguageCode


VIETNAMESE_TEXT = (
    "Kỹ sư phần mềm có kinh nghiệm phát triển REST API và kiến trúc vi "
    "dịch vụ bằng Java, Spring Boot và PostgreSQL. Đã xây dựng quy trình "
    "CI/CD và triển khai ứng dụng bằng Docker."
)


def test_vietnamese_preprocessing_is_nfc_and_repeatable() -> None:
    decomposed = unicodedata.normalize("NFD", VIETNAMESE_TEXT)

    precomposed = preprocess_vietnamese(VIETNAMESE_TEXT)
    first = preprocess_vietnamese(decomposed)
    second = preprocess_vietnamese(decomposed)

    assert first == second
    assert first.processed_text == precomposed.processed_text
    assert first.language.language_code is LanguageCode.VIETNAMESE
    assert first.language.confidence >= 0.65
    assert unicodedata.is_normalized("NFC", first.processed_text)


def test_meaningful_compounds_and_technical_tokens_are_preserved() -> None:
    result = preprocess_vietnamese(
        VIETNAMESE_TEXT
        + " Trí tuệ nhân tạo, học máy, cơ sở dữ liệu, điện toán đám mây, "
        "lập trình hướng đối tượng, kiểm thử phần mềm và quản lý dự án. "
        "Sử dụng C, R, C#, C++, .NET, ASP.NET và Node.js."
    )

    expected = {
        "kỹ_sư_phần_mềm",
        "kiến_trúc_vi_dịch_vụ",
        "rest_api",
        "spring_boot",
        "ci/cd",
        "trí_tuệ_nhân_tạo",
        "học_máy",
        "cơ_sở_dữ_liệu",
        "điện_toán_đám_mây",
        "lập_trình_hướng_đối_tượng",
        "kiểm_thử_phần_mềm",
        "quản_lý_dự_án",
        "c",
        "r",
        "c#",
        "c++",
        ".net",
        "asp.net",
        "node.js",
    }
    assert expected <= set(result.tokens)


def test_historical_placeholder_identifier_is_not_rewritten() -> None:
    tokens = tokenize_vietnamese("sjrprotectedtoken0000 và C")

    assert tokens == ("sjrprotectedtoken0000", "c")
    assert tokens.count("sjrprotectedtoken0000") == 1
    assert tokens.count("c") == 1


def test_multiple_technical_tokens_restore_without_placeholder_leakage() -> None:
    tokens = tokenize_vietnamese(
        "sjrprotectedtoken0000 C# C++ Node.js CI/CD"
    )

    assert tokens == (
        "sjrprotectedtoken0000",
        "c#",
        "c++",
        "node.js",
        "ci/cd",
    )
    assert all(
        not token.startswith("sjrprotectedtokenx")
        for token in tokens
    )


def test_placeholder_prefix_escalation_is_deterministic() -> None:
    source = (
        "sjrprotectedtoken0000 sjrprotectedtokenx0000 "
        "sjrprotectedtokenxx0000 C"
    )
    expected = (
        "sjrprotectedtoken0000",
        "sjrprotectedtokenx0000",
        "sjrprotectedtokenxx0000",
        "c",
    )

    assert tokenize_vietnamese(source) == expected
    assert all(tokenize_vietnamese(source) == expected for _ in range(10))


def test_vietnamese_stopwords_are_conservative() -> None:
    tokens = tokenize_vietnamese(
        "Chúng tôi đang phát triển phần mềm cho các dự án và người dùng."
    )

    assert "chúng" not in tokens
    assert "tôi" not in tokens
    assert "đang" not in tokens
    assert "và" not in tokens
    assert "phát_triển_phần_mềm" in tokens
    assert "dự_án" in tokens
    assert "người" in tokens
    assert "dùng" in tokens


def test_vietnamese_job_excludes_labels_and_skills_body() -> None:
    source = (
        "TITLE:\nLập trình viên Backend\n"
        "DESCRIPTION:\nPhát triển phần mềm cho người dùng và dự án.\n"
        "REQUIREMENTS:\nCó kinh nghiệm làm việc với hệ thống backend.\n"
        "SKILLS:\nKỹ sư phần mềm quản lý dự án Java Spring Boot"
    )

    result = preprocess_vietnamese_job(source)

    assert result.language.language_code is LanguageCode.VIETNAMESE
    assert "title" not in result.tokens
    assert "description" not in result.tokens
    assert "requirements" not in result.tokens
    assert "skills" not in result.tokens
    assert "kỹ_sư_phần_mềm" not in result.tokens
    assert "quản_lý_dự_án" not in result.tokens
    assert "spring_boot" not in result.tokens


def test_english_golden_output_is_unchanged() -> None:
    text = (
        "Software Engineer\nJava, Spring Boot, PostgreSQL\n"
        "Developed REST APIs and microservices\nBuilt CI/CD pipelines\n"
        "3 years experience"
    )

    assert preprocess_english(text).processed_text == (
        "software engineer java spring boot postgresql developed rest apis "
        "microservices built ci/cd pipelines 3 years experience"
    )


@pytest.mark.parametrize("invalid", [None, 1, b"text"])
def test_vietnamese_preprocessor_rejects_non_strings(invalid: object) -> None:
    with pytest.raises(TypeError, match="must be a string"):
        preprocess_vietnamese(invalid)  # type: ignore[arg-type]
