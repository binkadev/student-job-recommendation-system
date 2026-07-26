"""Tests for deterministic catalog-backed CV skill extraction."""

from __future__ import annotations

from types import MappingProxyType

import pytest

from v2.constants import SKILL_CATALOG_VERSION
from v2.skill_canonicalizer import SkillCatalog, load_default_catalog
from v2.skill_extractor import SkillExtractor


def _catalog(alias_to_canonical: dict[str, str]) -> SkillCatalog:
    canonical_to_aliases = {
        canonical: tuple(
            sorted(
                alias
                for alias, owner in alias_to_canonical.items()
                if owner == canonical
            )
        )
        for canonical in sorted(set(alias_to_canonical.values()))
    }
    return SkillCatalog(
        catalog_version=SKILL_CATALOG_VERSION,
        canonical_skills=frozenset(canonical_to_aliases),
        alias_to_canonical=MappingProxyType(
            dict(sorted(alias_to_canonical.items()))
        ),
        canonical_to_aliases=MappingProxyType(canonical_to_aliases),
    )


@pytest.fixture(scope="module")
def extractor() -> SkillExtractor:
    return SkillExtractor.from_catalog(load_default_catalog())


def test_extracts_punctuation_aware_technical_skills(
    extractor: SkillExtractor,
) -> None:
    text = "C, C#, C++, .NET, Node.js, CI/CD, Java and PostgreSQL"

    assert extractor.extract(text) == (
        ".net",
        "c",
        "c#",
        "c++",
        "ci/cd",
        "java",
        "nodejs",
        "postgresql",
    )


def test_longest_matches_prevent_nested_skills_for_one_span(
    extractor: SkillExtractor,
) -> None:
    text = "Spring Boot, React Native, and GitHub Actions"

    assert extractor.extract(text) == (
        "github actions",
        "react native",
        "spring boot",
    )


def test_separate_non_overlapping_nested_skill_is_retained(
    extractor: SkillExtractor,
) -> None:
    text = "Spring Boot services and the Spring framework"

    assert extractor.extract(text) == ("spring", "spring boot")


def test_aliases_are_deduplicated_and_sorted(
    extractor: SkillExtractor,
) -> None:
    text = "postgres postgresQL PostgreSQL springboot Spring-Boot"

    assert extractor.extract(text) == ("postgresql", "spring boot")


def test_conservative_short_aliases_require_conventional_casing(
    extractor: SkillExtractor,
) -> None:
    lower_prose = "we go to rest while using ai ml js ts tf c and r"
    technical = "Go REST AI ML JS TS TF C R"

    assert extractor.extract(lower_prose) == ()
    assert extractor.extract(technical) == (
        "artificial intelligence",
        "c",
        "go",
        "javascript",
        "machine learning",
        "r",
        "rest api",
        "tensorflow",
        "typescript",
    )


def test_matching_is_unicode_nfc_and_whitespace_normalized() -> None:
    custom = _catalog({"café data": "café data"})
    extractor = SkillExtractor.from_catalog(custom)

    assert extractor.extract("Cafe\u0301\tdata") == ("café data",)


def test_does_not_fuzzy_match_or_match_inside_words(
    extractor: SkillExtractor,
) -> None:
    text = "Javaish Postgresq and SpringBootcamp are not catalog aliases."

    assert extractor.extract(text) == ()


def test_extracts_longest_vietnamese_aliases_without_generic_false_positives(
    extractor: SkillExtractor,
) -> None:
    text = (
        "Trí tuệ nhân tạo, học máy, cơ sở dữ liệu, điện toán đám mây, "
        "kiến trúc vi dịch vụ, lập trình hướng đối tượng, kiểm thử phần mềm "
        "và quản lý dự án."
    )

    assert extractor.extract(text) == (
        "artificial intelligence",
        "cloud computing",
        "database",
        "machine learning",
        "microservices",
        "object oriented programming",
        "project management",
        "software testing",
    )


def test_generic_vietnamese_words_are_not_skills(
    extractor: SkillExtractor,
) -> None:
    assert extractor.extract(
        "hệ thống ứng dụng dữ liệu dịch vụ web phần mềm phát triển quản lý "
        "kiểm thử đám mây"
    ) == ()


def test_output_is_sorted_before_the_200_skill_cap() -> None:
    aliases = {
        f"skill{index:03d}": f"skill{index:03d}"
        for index in range(205)
    }
    extractor = SkillExtractor.from_catalog(_catalog(aliases))
    text = " ".join(reversed(tuple(aliases)))

    result = extractor.extract(text)

    assert len(result) == 200
    assert result == tuple(f"skill{index:03d}" for index in range(200))


@pytest.mark.parametrize("limit", [0, -1, True, 1.5])
def test_limit_must_be_a_positive_integer(limit: object) -> None:
    extractor = SkillExtractor.from_catalog(load_default_catalog())

    with pytest.raises(ValueError, match="positive integer"):
        extractor.extract("Java", limit=limit)  # type: ignore[arg-type]
