"""Shared test-only environment configuration and session-scoped AI fixtures."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from core.config import load_settings
from nlp.english_pipeline import LoadedSpacyPipeline, load_compiled_spacy_pipeline
from scoring.tfidf_artifact import TfidfModelArtifact, load_tfidf_artifact


TEST_INTERNAL_API_KEY = "test-ai-internal-api-key-at-least-32-characters"

os.environ["AI_INTERNAL_API_KEY"] = TEST_INTERNAL_API_KEY


@pytest.fixture(scope="session")
def spacy_pipeline() -> LoadedSpacyPipeline:
    """Load the offline-compiled English spaCy EntityRuler pipeline once."""

    settings = load_settings()
    return load_compiled_spacy_pipeline(settings.spacy_model_dir)


@pytest.fixture(scope="session")
def tfidf_artifact(spacy_pipeline: LoadedSpacyPipeline) -> TfidfModelArtifact:
    """Load the Global IDF tfidf_model.pkl artifact once."""

    settings = load_settings()
    return load_tfidf_artifact(
        settings.tfidf_model_path,
        bootstrap_fallback_path=settings.tfidf_bootstrap_model_path,
        expected_nlp_model_hash=spacy_pipeline.model_hash,
    )


@pytest.fixture(scope="session")
def ai_service_root() -> Path:
    return Path(__file__).resolve().parents[1]
