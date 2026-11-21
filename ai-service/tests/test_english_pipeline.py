"""Unit tests for the 3-stage English spaCy NLP pipeline."""

from __future__ import annotations

import pytest

from nlp.english_pipeline import (
    LoadedSpacyPipeline,
    UnsupportedLanguageError,
    preprocess_english,
    preprocess_english_job,
    tokenize_english,
)
from schemas.common import LanguageCode


def test_merges_skills_and_domain_phrases_as_protected_tokens(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    text = (
        "John Smith is a SoftwareEngineer with experience in Java,SpringBoot, "
        "REST API, Node.js, C++, C#, .NET, CI/CD, and MachineLearning."
    )
    tokens = tokenize_english(text, nlp=spacy_pipeline.nlp)

    assert "software_engineer" in tokens
    assert "java" in tokens
    assert "spring_boot" in tokens
    assert "rest_api" in tokens
    assert "nodejs" in tokens
    assert "c++" in tokens
    assert "c#" in tokens
    assert ".net" in tokens
    assert "ci/cd" in tokens
    assert "machine_learning" in tokens
    # PERSON entity stripped in Stage 3
    assert "john" not in tokens
    assert "smith" not in tokens


def test_case_sensitive_short_aliases_do_not_match_ordinary_english_prose(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    prose = "We should go to the office and take a rest after building our project."
    prose_tokens = tokenize_english(prose, nlp=spacy_pipeline.nlp)
    assert "go" not in prose_tokens
    assert "rest_api" not in prose_tokens
    assert "c" not in prose_tokens
    assert "r" not in prose_tokens

    technical = "We developed services with Go, REST, C, R, AI, ML, JS, TS, and TF."
    tech_tokens = tokenize_english(technical, nlp=spacy_pipeline.nlp)
    for expected in (
        "go",
        "rest_api",
        "c",
        "r",
        "artificial_intelligence",
        "machine_learning",
        "javascript",
        "typescript",
        "tensorflow",
    ):
        assert expected in tech_tokens


def test_preprocess_english_job_strips_skills_section(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    job_text = (
        "TITLE:\n"
        "Backend Developer Intern\n"
        "DESCRIPTION:\n"
        "We develop reliable backend services with Java and Spring Boot.\n"
        "REQUIREMENTS:\n"
        "Experience with PostgreSQL and Docker.\n"
        "SKILLS:\n"
        "Kubernetes\nTerraform\nCassandra\n"
    )
    result = preprocess_english_job(job_text, nlp=spacy_pipeline.nlp)

    assert result.language.language_code is LanguageCode.ENGLISH
    assert "backend_developer" in result.tokens
    assert "java" in result.tokens
    assert "spring_boot" in result.tokens
    assert "postgresql" in result.tokens
    assert "docker" in result.tokens
    # SKILLS section excluded so TF-IDF never double-counts declared skills
    assert "kubernetes" not in result.tokens
    assert "terraform" not in result.tokens
    assert "cassandra" not in result.tokens


def test_preprocess_english_rejects_non_english_and_low_confidence(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    non_english = (
        "Nous developpons des services logiciels avec Java, Spring Boot et "
        "PostgreSQL pour nos utilisateurs."
    )
    with pytest.raises(UnsupportedLanguageError):
        preprocess_english(non_english, nlp=spacy_pipeline.nlp)

    skill_list_only = "Java, Spring Boot, PostgreSQL, Docker, Kubernetes"
    with pytest.raises(UnsupportedLanguageError):
        preprocess_english(skill_list_only, nlp=spacy_pipeline.nlp)


def test_pipeline_is_deterministic_across_repeated_calls(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    sample = (
        "Software Engineer with experience building REST API microservices "
        "using Java, Spring Boot, PostgreSQL, Docker, and CI/CD pipelines."
    )
    first = preprocess_english(sample, nlp=spacy_pipeline.nlp)
    second = preprocess_english(sample, nlp=spacy_pipeline.nlp)

    assert first == second
