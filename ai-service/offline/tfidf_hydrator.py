"""Mathematical Global IDF computation and atomic TfidfVectorizer serialization.

Computes exact smooth global IDF weights from incremental ``(N, term_df)``
counters without ever calling ``TfidfVectorizer.fit()`` over the whole corpus:

    idf(t) = ln((1 + N) / (1 + df(t))) + 1

Hydrates an authentic fitted scikit-learn ``TfidfVectorizer`` configured with
``tokenizer=str.split``, ``ngram_range=(1, 1)``, ``sublinear_tf=True``,
``norm='l2'``, and exports it atomically to ``tfidf_model.pkl`` alongside
``tfidf_model.meta.json``.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import pickle
import shutil

import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfTransformer, TfidfVectorizer


ARTIFACT_FORMAT_VERSION = 1
DEFAULT_NGRAM_RANGE = (1, 1)
DEFAULT_MAX_FEATURES = 50_000
DEFAULT_MAX_DF_FRACTION = 0.95


def select_vocabulary(
    *,
    total_docs: int,
    term_df: Mapping[str, int],
    min_df: int = 1,
    max_df_fraction: float = DEFAULT_MAX_DF_FRACTION,
    max_features: int = DEFAULT_MAX_FEATURES,
    protected_terms: frozenset[str] = frozenset(),
) -> dict[str, int]:
    """Filter global terms deterministically and assign sorted feature indices."""

    if total_docs <= 0:
        raise ValueError("total_docs must be positive to build a TF-IDF model")
    if min_df < 1:
        raise ValueError("min_df must be at least 1")
    if not (0.0 < max_df_fraction <= 1.0):
        raise ValueError("max_df_fraction must be in (0, 1]")
    if max_features < 1:
        raise ValueError("max_features must be positive")

    max_df_count = (
        math.floor(max_df_fraction * total_docs)
        if total_docs >= 20
        else total_docs
    )
    max_df_count = max(max_df_count, min_df)

    eligible: list[tuple[str, int]] = []
    for term, df in term_df.items():
        if df <= 0 or df > total_docs:
            raise ValueError(
                f"Invalid document frequency df={df} for term={term!r} (N={total_docs})"
            )
        is_protected = term in protected_terms
        if not is_protected and (df < min_df or df > max_df_count):
            continue
        eligible.append((term, df))

    if not eligible:
        raise ValueError("Vocabulary pruning produced an empty vocabulary")

    if len(eligible) > max_features:
        # Keep protected terms first, then highest-DF terms breaking ties
        # lexicographically to guarantee deterministic cross-platform order.
        eligible.sort(
            key=lambda item: (
                0 if item[0] in protected_terms else 1,
                -item[1],
                item[0],
            )
        )
        eligible = eligible[:max_features]

    sorted_terms = sorted(term for term, _df in eligible)
    return {term: index for index, term in enumerate(sorted_terms)}


def hydrate_tfidf_vectorizer(
    *,
    total_docs: int,
    term_df: Mapping[str, int],
    ngram_range: tuple[int, int] = DEFAULT_NGRAM_RANGE,
    min_df: int = 1,
    max_df_fraction: float = DEFAULT_MAX_DF_FRACTION,
    max_features: int = DEFAULT_MAX_FEATURES,
    protected_terms: frozenset[str] = frozenset(),
) -> TfidfVectorizer:
    """Hydrate a fitted sklearn TfidfVectorizer directly from global DF counts."""

    vocabulary = select_vocabulary(
        total_docs=total_docs,
        term_df=term_df,
        min_df=min_df,
        max_df_fraction=max_df_fraction,
        max_features=max_features,
        protected_terms=protected_terms,
    )

    vectorizer = TfidfVectorizer(
        analyzer="word",
        tokenizer=str.split,
        token_pattern=None,
        lowercase=False,
        ngram_range=ngram_range,
        sublinear_tf=True,
        norm="l2",
        use_idf=True,
        smooth_idf=True,
        stop_words=None,
        vocabulary=vocabulary,
    )
    vectorizer.vocabulary_ = vocabulary
    vectorizer.fixed_vocabulary_ = True

    n_features = len(vocabulary)
    df_array = np.empty(n_features, dtype=np.float64)
    for term, index in vocabulary.items():
        df_array[index] = float(term_df[term])

    # Exact sklearn smooth IDF: ln((1 + N) / (1 + df)) + 1.0
    idf_array = np.log((1.0 + float(total_docs)) / (1.0 + df_array)) + 1.0

    # Hydrate internal TfidfTransformer fitted state directly (sklearn 1.9.0).
    transformer = TfidfTransformer(
        norm="l2",
        use_idf=True,
        smooth_idf=True,
        sublinear_tf=True,
    )
    transformer.n_features_in_ = n_features
    transformer.idf_ = idf_array
    vectorizer._tfidf = transformer
    return vectorizer


def build_artifact_payload(
    *,
    vectorizer: TfidfVectorizer,
    total_docs: int,
    nlp_model_hash: str,
    bootstrap_doc_count: int = 0,
    live_doc_count: int = 0,
    trained_at: str | None = None,
) -> dict[str, object]:
    """Wrap the hydrated TfidfVectorizer in a versioned metadata envelope."""

    timestamp = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        if trained_at is None
        else trained_at
    )
    vocab_digest = hashlib.sha256()
    for term, index in sorted(vectorizer.vocabulary_.items()):
        vocab_digest.update(f"{index}:{term}:{vectorizer.idf_[index]:.12f}\n".encode("utf-8"))
    vocab_hash = vocab_digest.hexdigest()
    compact_ts = timestamp.replace("-", "").replace(":", "").replace("+00:00", "Z")
    model_version = f"global-idf-{compact_ts}-{vocab_hash[:8]}"

    return {
        "formatVersion": ARTIFACT_FORMAT_VERSION,
        "modelVersion": model_version,
        "trainedAt": timestamp,
        "sklearnVersion": sklearn.__version__,
        "numpyVersion": np.__version__,
        "nlpModelHash": nlp_model_hash,
        "docCount": int(total_docs),
        "bootstrapDocCount": int(bootstrap_doc_count),
        "liveDocCount": int(live_doc_count),
        "vocabSize": int(len(vectorizer.vocabulary_)),
        "vocabHash": vocab_hash,
        "ngramRange": tuple(vectorizer.ngram_range),
        "sublinearTf": bool(vectorizer.sublinear_tf),
        "vectorizer": vectorizer,
    }


def write_artifact_atomically(
    *,
    payload: Mapping[str, object],
    output_path: Path,
    keep_previous_backup: bool = True,
) -> Path:
    """Atomically write ``tfidf_model.pkl`` and sidecar ``tfidf_model.meta.json``."""

    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = target.with_suffix(target.suffix + ".tmp")

    with tmp_path.open("wb") as stream:
        pickle.dump(dict(payload), stream, protocol=pickle.HIGHEST_PROTOCOL)
        stream.flush()
        os.fsync(stream.fileno())

    if keep_previous_backup and target.is_file():
        backup_path = target.with_suffix(target.suffix + ".prev")
        shutil.copy2(target, backup_path)

    os.replace(tmp_path, target)

    metadata = {
        key: (list(value) if isinstance(value, tuple) else value)
        for key, value in payload.items()
        if key != "vectorizer"
    }
    meta_path = target.with_suffix(".meta.json")
    meta_tmp = target.with_suffix(".meta.json.tmp")
    with meta_tmp.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(metadata, indent=2, sort_keys=True) + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(meta_tmp, meta_path)
    return target


__all__ = [
    "ARTIFACT_FORMAT_VERSION",
    "DEFAULT_MAX_DF_FRACTION",
    "DEFAULT_MAX_FEATURES",
    "DEFAULT_NGRAM_RANGE",
    "build_artifact_payload",
    "hydrate_tfidf_vectorizer",
    "select_vocabulary",
    "write_artifact_atomically",
]
