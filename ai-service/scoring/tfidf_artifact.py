"""Immutable online loader for the Global IDF ``tfidf_model.pkl`` artifact.

Online ``ai-service`` loads this artifact ONCE into RAM at startup and executes
``.transform()`` ONLY during recommendation and candidate-ranking requests.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import pickle

import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from core.config import ConfigurationError


SUPPORTED_ARTIFACT_FORMAT_VERSION = 1


@dataclass(frozen=True, slots=True)
class TfidfModelArtifact:
    """Validated immutable Global IDF vectorizer loaded into RAM."""

    vectorizer: TfidfVectorizer
    model_version: str
    trained_at: str
    nlp_model_hash: str
    doc_count: int
    vocab_size: int
    source_path: Path
    source_kind: str  # "mounted" | "bootstrap"

    def transform_and_cosine_similarity(
        self,
        *,
        query_text: str,
        target_texts: list[str],
    ) -> tuple[float, ...]:
        """Compute finite cosine similarities using .transform() ONLY (no .fit)."""

        if not target_texts:
            return ()
        query_vector = self.vectorizer.transform([query_text])
        target_vectors = self.vectorizer.transform(target_texts)
        similarities = cosine_similarity(query_vector, target_vectors).ravel()
        return tuple(float(value) for value in similarities)


def load_tfidf_artifact(
    model_path: Path,
    *,
    bootstrap_fallback_path: Path | None = None,
    expected_nlp_model_hash: str | None = None,
) -> TfidfModelArtifact:
    """Load and validate ``tfidf_model.pkl`` with explicit cold-start fallback.

    If ``model_path`` exists, it MUST be valid (never silently masked). Only
    when ``model_path`` does not exist yet (e.g., fresh empty mounted volume)
    does startup fall back to ``bootstrap_fallback_path``.
    """

    primary = Path(model_path)
    if primary.is_file():
        chosen_path = primary
        source_kind = "mounted"
    elif bootstrap_fallback_path is not None and Path(bootstrap_fallback_path).is_file():
        chosen_path = Path(bootstrap_fallback_path)
        source_kind = "bootstrap"
    else:
        raise ConfigurationError(
            f"TF-IDF model artifact not found at {primary}"
            + (
                f" (bootstrap fallback {bootstrap_fallback_path} also missing)"
                if bootstrap_fallback_path is not None
                else ""
            )
        )

    try:
        with chosen_path.open("rb") as stream:
            payload = pickle.load(stream)
    except Exception as error:
        raise ConfigurationError(
            f"Failed to deserialize TF-IDF artifact at {chosen_path}"
        ) from error

    if not isinstance(payload, dict):
        raise ConfigurationError("TF-IDF artifact root payload must be a dict")
    if payload.get("formatVersion") != SUPPORTED_ARTIFACT_FORMAT_VERSION:
        raise ConfigurationError(
            f"Unsupported TF-IDF artifact formatVersion: {payload.get('formatVersion')!r}"
        )

    vectorizer = payload.get("vectorizer")
    if not isinstance(vectorizer, TfidfVectorizer):
        raise ConfigurationError("TF-IDF artifact missing valid TfidfVectorizer")
    if not getattr(vectorizer, "vocabulary_", None):
        raise ConfigurationError("TF-IDF artifact has empty vocabulary")

    artifact_sklearn = payload.get("sklearnVersion")
    if artifact_sklearn != sklearn.__version__:
        raise ConfigurationError(
            f"TF-IDF artifact sklearnVersion={artifact_sklearn!r} does not "
            f"match runtime sklearn={sklearn.__version__!r}; rebuild artifact"
        )

    artifact_nlp_hash = payload.get("nlpModelHash")
    if not isinstance(artifact_nlp_hash, str) or len(artifact_nlp_hash) < 16:
        raise ConfigurationError("TF-IDF artifact missing valid nlpModelHash")
    if expected_nlp_model_hash is not None and artifact_nlp_hash != expected_nlp_model_hash:
        raise ConfigurationError(
            "TF-IDF artifact nlpModelHash does not match loaded spaCy model "
            f"({artifact_nlp_hash[:12]} != {expected_nlp_model_hash[:12]}); "
            "rebuild tfidf_model.pkl with matching spaCy model"
        )

    doc_count = payload.get("docCount")
    vocab_size = payload.get("vocabSize")
    model_version = payload.get("modelVersion")
    trained_at = payload.get("trainedAt")
    if (
        not isinstance(doc_count, int)
        or doc_count <= 0
        or not isinstance(vocab_size, int)
        or vocab_size != len(vectorizer.vocabulary_)
        or not isinstance(model_version, str)
        or not model_version.strip()
        or not isinstance(trained_at, str)
        or not trained_at.strip()
    ):
        raise ConfigurationError("TF-IDF artifact contains invalid metadata")

    # Smoke-check that .transform() executes cleanly on the loaded vectorizer.
    try:
        probe = vectorizer.transform(["java"])
        if probe.shape != (1, vocab_size) or not np.isfinite(probe.data).all():
            raise ConfigurationError("TF-IDF artifact transform smoke check failed")
    except ConfigurationError:
        raise
    except Exception as error:
        raise ConfigurationError(
            "TF-IDF artifact failed .transform() smoke verification"
        ) from error

    return TfidfModelArtifact(
        vectorizer=vectorizer,
        model_version=model_version,
        trained_at=trained_at,
        nlp_model_hash=artifact_nlp_hash,
        doc_count=doc_count,
        vocab_size=vocab_size,
        source_path=chosen_path,
        source_kind=source_kind,
    )


__all__ = [
    "SUPPORTED_ARTIFACT_FORMAT_VERSION",
    "TfidfModelArtifact",
    "load_tfidf_artifact",
]
