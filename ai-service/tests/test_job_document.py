"""Tests for deterministic fixed-section Job document parsing."""

from dataclasses import FrozenInstanceError

import pytest

from v2.job_document import JobSection, parse_job_document


def test_parses_supported_headings_and_excludes_labels_and_skills() -> None:
    source = (
        "Hiring for the platform team.\r\n"
        " title : \r\n"
        "Backend Developer\r\n"
        "DESCRIPTION\r\n"
        "Build reliable services.\r\n"
        "requirements:\r\n"
        "Work with the product team.\r\n"
        "SkIlLs\r\n"
        "Java, Spring Boot, PostgreSQL\r\n"
    )

    document = parse_job_document(source)

    assert [section.name for section in document.sections] == [
        "preamble",
        "title",
        "description",
        "requirements",
        "skills",
    ]
    assert document.similarity_text == (
        "Hiring for the platform team.\n"
        "Backend Developer\n"
        "Build reliable services.\n"
        "Work with the product team."
    )
    assert document.language_evidence_text == document.similarity_text
    assert "TITLE" not in document.similarity_text
    assert "SKILLS" not in document.similarity_text
    assert "Spring Boot" not in document.similarity_text


def test_heading_must_occupy_the_complete_trimmed_line() -> None:
    source = (
        "TITLE: Backend Developer\n"
        "DESCRIPTION - Build APIs\n"
        "SKILLS: Java, Spring Boot\n"
    )

    document = parse_job_document(source)

    assert document.sections == (
        JobSection(
            "preamble",
            "TITLE: Backend Developer\n"
            "DESCRIPTION - Build APIs\n"
            "SKILLS: Java, Spring Boot\n",
        ),
    )
    assert document.similarity_text == source.strip()


def test_skills_body_is_suppressed_until_the_next_recognized_heading() -> None:
    source = (
        "DESCRIPTION:\n"
        "Build APIs for our users.\n"
        "SKILLS:\n"
        "Java\n"
        "TITLE: This is not a full-line heading\n"
        "and the with our\n"
        "REQUIREMENTS:\n"
        "You will work with our team.\n"
    )

    document = parse_job_document(source)

    assert document.similarity_text == (
        "Build APIs for our users.\nYou will work with our team."
    )
    assert "Java" not in document.similarity_text
    assert "not a full-line heading" not in document.similarity_text
    assert "and the with our" not in document.similarity_text


def test_repeated_sections_remain_in_encounter_order() -> None:
    source = (
        "DESCRIPTION\n"
        "First description.\n"
        "REQUIREMENTS\n"
        "First requirement.\n"
        "DESCRIPTION:\n"
        "Second description.\n"
        "SKILLS:\n"
        "Hidden skill.\n"
        "REQUIREMENTS:\n"
        "Second requirement."
    )

    document = parse_job_document(source)

    assert [section.name for section in document.sections] == [
        "description",
        "requirements",
        "description",
        "skills",
        "requirements",
    ]
    assert document.similarity_text == (
        "First description.\n"
        "First requirement.\n"
        "Second description.\n"
        "Second requirement."
    )


def test_parses_exact_backend_v2_job_text_layout_with_blank_requirements() -> None:
    source = (
        "TITLE:\n"
        "Platform Engineer\n"
        "\n"
        "DESCRIPTION:\n"
        "Docker\n"
        "\n"
        "REQUIREMENTS:\n"
        "\n"
        "\n"
        "SKILLS:\n"
    )

    document = parse_job_document(source)

    assert document.similarity_text == "Platform Engineer\n\nDocker"
    assert document.language_evidence_text == document.similarity_text
    assert "SKILLS" not in document.similarity_text


@pytest.mark.parametrize(
    "source",
    [
        "Unstructured Job text with no headings.",
        "TITLE: inline content is not a heading",
        "",
    ],
)
def test_text_without_recognized_headings_is_unstructured(source: str) -> None:
    document = parse_job_document(source)

    assert document.sections == (JobSection("preamble", source),)
    assert document.similarity_text == source.strip()
    assert document.language_evidence_text == source.strip()


def test_parser_result_is_immutable() -> None:
    document = parse_job_document("TITLE:\nDeveloper")

    with pytest.raises(FrozenInstanceError):
        document.similarity_text = "changed"  # type: ignore[misc]


def test_parser_rejects_non_string_input() -> None:
    with pytest.raises(TypeError, match="must be a string"):
        parse_job_document(None)  # type: ignore[arg-type]
