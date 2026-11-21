"""Shared 3-stage English NLP pipeline (Regex -> spaCy EntityRuler -> NER/POS).

Both the online stateless AI service and the offline Incremental DF builder
invoke this exact module so ``processed_text`` tokens match ``tfidf_model.pkl``
100% identically.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re

import spacy
from spacy.language import Language

from core.config import ConfigurationError
from core.constants import LANGUAGE_CONFIDENCE_THRESHOLD
from schemas.common import LanguageCode

from .denoiser import denoise_english_text
from .job_document import parse_job_document
from .language_detector import LanguageDetection, detect_language


_MANIFEST_FILENAME = "model_manifest.json"
_PROTECTED_ENTITY_LABELS = frozenset({"SKILL", "CUSTOM_PHRASE"})
_DROPPED_NER_LABELS = frozenset(
    {
        "PERSON",
        "DATE",
        "TIME",
        "MONEY",
        "PERCENT",
        "QUANTITY",
        "ORDINAL",
        "CARDINAL",
    }
)
_KEPT_POS_TAGS = frozenset({"NOUN", "PROPN", "VERB", "ADJ"})
_VALID_OUTPUT_TOKEN_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_+.#/-]*$")


class UnsupportedLanguageError(ValueError):
    """Raised when content does not meet the English confidence floor."""

    def __init__(self, detection: LanguageDetection) -> None:
        self.language_code = detection.language_code
        self.confidence = detection.confidence
        super().__init__(
            "English preprocessing requires language=en with confidence "
            f">={LANGUAGE_CONFIDENCE_THRESHOLD:.2f}; received "
            f"{detection.language_code.value} at {detection.confidence:.8f}"
        )


@dataclass(frozen=True, slots=True)
class EnglishPreprocessingResult:
    """Immutable English text prepared for whitespace-tokenized Global TF-IDF."""

    processed_text: str
    tokens: tuple[str, ...]
    language: LanguageDetection


@dataclass(frozen=True, slots=True)
class LoadedSpacyPipeline:
    """Compiled offline spaCy pipeline and integrity manifest loaded into RAM."""

    nlp: Language
    model_dir: Path
    model_hash: str
    spacy_version: str
    catalog_version: str
    phrases_version: str


def load_compiled_spacy_pipeline(model_dir: Path) -> LoadedSpacyPipeline:
    """Load an offline-compiled spaCy model and manifest from disk once."""

    resolved_dir = Path(model_dir)
    if not resolved_dir.is_dir():
        raise ConfigurationError(
            f"Compiled spaCy model directory does not exist: {resolved_dir}"
        )
    manifest_path = resolved_dir / _MANIFEST_FILENAME
    if not manifest_path.is_file():
        raise ConfigurationError(
            f"Missing spaCy model manifest: {manifest_path}"
        )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConfigurationError(
            f"Invalid spaCy model manifest at {manifest_path}"
        ) from error

    model_hash = manifest.get("nlpModelHash")
    if not isinstance(model_hash, str) or len(model_hash) < 16:
        raise ConfigurationError("spaCy model manifest missing valid nlpModelHash")

    try:
        nlp = spacy.load(resolved_dir)
    except Exception as error:
        raise ConfigurationError(
            f"Failed to load compiled spaCy model from {resolved_dir}"
        ) from error

    required_pipes = {"entity_ruler", "ner", "merge_entities"}
    missing_pipes = required_pipes - set(nlp.pipe_names)
    if missing_pipes:
        raise ConfigurationError(
            f"Compiled spaCy model missing required pipes: {sorted(missing_pipes)}"
        )

    return LoadedSpacyPipeline(
        nlp=nlp,
        model_dir=resolved_dir,
        model_hash=model_hash,
        spacy_version=str(manifest.get("spacyVersion", spacy.__version__)),
        catalog_version=str(manifest.get("catalogVersion", "")),
        phrases_version=str(manifest.get("phrasesVersion", "")),
    )


def tokenize_english(
    text: str,
    *,
    nlp: Language,
) -> tuple[str, ...]:
    """Execute Stage 1 (Regex) -> Stage 2 (EntityRuler merge) -> Stage 3 (NER/POS)."""

    if not isinstance(text, str):
        raise TypeError("English preprocessing text must be a string")

    denoised = denoise_english_text(text)
    if not denoised:
        return ()

    doc = nlp(denoised)
    tokens: list[str] = []
    for token in doc:
        # Stage 2 guarantee: merged SKILL / CUSTOM_PHRASE tokens are preserved
        # verbatim via their canonical entity ID, immune to POS/stopword drops.
        if token.ent_type_ in _PROTECTED_ENTITY_LABELS:
            canonical = (token.ent_id_ or token.text).strip().lower()
            canonical = "_".join(canonical.split())
            if canonical:
                tokens.append(canonical)
            continue

        # Stage 3: strip personal/noise NER entities and filter POS/stopwords.
        if token.ent_type_ in _DROPPED_NER_LABELS:
            continue
        if (
            token.is_space
            or token.is_punct
            or token.is_stop
            or token.like_num
            or token.like_email
            or token.like_url
        ):
            continue
        if token.pos_ not in _KEPT_POS_TAGS:
            continue

        lemma = token.lemma_.strip().lower()
        if not lemma or lemma == "-pron-":
            lemma = token.text.strip().lower()
        if len(lemma) < 2:
            continue
        if not _VALID_OUTPUT_TOKEN_PATTERN.fullmatch(lemma):
            continue
        tokens.append(lemma)

    return tuple(tokens)


def preprocess_english(
    text: str,
    *,
    nlp: Language,
    detection: LanguageDetection | None = None,
) -> EnglishPreprocessingResult:
    """Validate English confidence and run the 3-stage English NLP pipeline."""

    if not isinstance(text, str):
        raise TypeError("English preprocessing text must be a string")

    if detection is None:
        detection = detect_language(text)
    if (
        detection.language_code is not LanguageCode.ENGLISH
        or detection.confidence < LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        raise UnsupportedLanguageError(detection)

    tokens = tokenize_english(text, nlp=nlp)
    return EnglishPreprocessingResult(
        processed_text=" ".join(tokens),
        tokens=tokens,
        language=detection,
    )


def preprocess_english_job(
    text: str,
    *,
    nlp: Language,
    detection: LanguageDetection | None = None,
) -> EnglishPreprocessingResult:
    """Parse a Job and run the 3-stage pipeline on non-SKILLS lexical content."""

    job_document = parse_job_document(text)
    return preprocess_english(
        job_document.similarity_text,
        nlp=nlp,
        detection=detection,
    )


__all__ = [
    "EnglishPreprocessingResult",
    "LoadedSpacyPipeline",
    "UnsupportedLanguageError",
    "load_compiled_spacy_pipeline",
    "preprocess_english",
    "preprocess_english_job",
    "tokenize_english",
]
