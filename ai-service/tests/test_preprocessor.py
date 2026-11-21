"""Tests for the English-only preprocessing facade and zero-underthesea invariant."""

from __future__ import annotations

import ast
from dataclasses import FrozenInstanceError
import inspect

import pytest

import core.constants as constants_module
import nlp.denoiser as denoiser_module
import nlp.english_pipeline as english_pipeline_module
import nlp.job_document as job_document_module
import nlp.language_detector as language_detector_module
import nlp.preprocessor as preprocessor_module
import nlp.skill_canonicalizer as skill_canonicalizer_module
from nlp.english_pipeline import LoadedSpacyPipeline
from nlp.preprocessor import (
    UnsupportedLanguageError,
    preprocess_english,
    preprocess_english_job,
    preprocess_supported,
    tokenize_english,
)
from schemas.common import LanguageCode


ENGLISH_CONTEXT = (
    "Software Engineer with experience developing REST APIs and microservices "
    "with Java, Spring Boot, PostgreSQL, Docker, C++, C#, .NET, Node.js, and CI/CD."
)


def test_preprocess_english_and_supported_match_identically(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    direct = preprocess_english(ENGLISH_CONTEXT, nlp=spacy_pipeline.nlp)
    supported = preprocess_supported(ENGLISH_CONTEXT, nlp=spacy_pipeline.nlp)

    assert direct == supported
    assert direct.language.language_code is LanguageCode.ENGLISH
    for token in (
        "software_engineer",
        "rest_api",
        "microservices",
        "java",
        "spring_boot",
        "postgresql",
        "docker",
        "c++",
        "c#",
        ".net",
        "nodejs",
        "ci/cd",
    ):
        assert token in direct.tokens


def test_preprocess_english_job_rejects_unknown_language(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    source = (
        "TITLE:\nJava Developer\n"
        "SKILLS:\nWe are looking for a developer who will work with our team."
    )
    with pytest.raises(UnsupportedLanguageError) as error:
        preprocess_english_job(source, nlp=spacy_pipeline.nlp)

    assert error.value.language_code is LanguageCode.UNKNOWN
    assert error.value.confidence == 0.0


def test_preprocessing_result_is_immutable(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    result = preprocess_english(ENGLISH_CONTEXT, nlp=spacy_pipeline.nlp)
    with pytest.raises(FrozenInstanceError):
        result.processed_text = "changed"  # type: ignore[misc]


def test_underthesea_is_completely_absent_from_all_nlp_modules() -> None:
    modules = (
        constants_module,
        denoiser_module,
        english_pipeline_module,
        job_document_module,
        language_detector_module,
        preprocessor_module,
        skill_canonicalizer_module,
    )
    for module in modules:
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


def test_preprocessor_rejects_non_string_input(
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    with pytest.raises(TypeError, match="must be a string"):
        preprocess_english(None, nlp=spacy_pipeline.nlp)  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="must be a string"):
        tokenize_english(None, nlp=spacy_pipeline.nlp)  # type: ignore[arg-type]
