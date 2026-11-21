"""English-only preprocessing facade backed by the 3-stage spaCy pipeline."""

from __future__ import annotations

from spacy.language import Language

from .english_pipeline import (
    EnglishPreprocessingResult,
    LoadedSpacyPipeline,
    UnsupportedLanguageError,
    load_compiled_spacy_pipeline,
    preprocess_english,
    preprocess_english_job,
    tokenize_english,
)


def preprocess_supported(
    text: str,
    *,
    nlp: Language,
) -> EnglishPreprocessingResult:
    """Preprocess one confidently English document (non-English rejected)."""

    return preprocess_english(text, nlp=nlp)


__all__ = [
    "EnglishPreprocessingResult",
    "LoadedSpacyPipeline",
    "UnsupportedLanguageError",
    "load_compiled_spacy_pipeline",
    "preprocess_english",
    "preprocess_english_job",
    "preprocess_supported",
    "tokenize_english",
]
