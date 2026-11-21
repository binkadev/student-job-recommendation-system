"""Unit tests proving Incremental DF mathematical equivalence and .pkl safety."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest
from sklearn.feature_extraction.text import TfidfVectorizer

from core.config import ConfigurationError
from nlp.english_pipeline import LoadedSpacyPipeline
from offline.incremental_df_store import (
    BOOTSTRAP_DOC_TYPES,
    IncrementalDfStore,
    compute_content_hash,
)
from offline.tfidf_hydrator import (
    build_artifact_payload,
    hydrate_tfidf_vectorizer,
    write_artifact_atomically,
)
from offline.train_tfidf_incremental import ingest_bootstrap_csvs, run_training
from scoring.tfidf_artifact import load_tfidf_artifact


def test_incremental_insert_update_delete_matches_full_sklearn_fit_exactly(
    tmp_path: Path,
) -> None:
    """Prove incremental(batch1 + batch2 + update + delete) == sklearn.fit(final)."""

    state_path = tmp_path / "df_state.sqlite"
    with IncrementalDfStore(state_path) as store:
        # Batch 1: INSERT 3 docs
        batch1 = {
            "cv:1": "software_engineer java spring_boot postgresql docker rest_api",
            "cv:2": "frontend_developer react typescript javascript html css",
            "job:1": "backend_developer java spring_boot docker microservices",
        }
        for key, text in batch1.items():
            assert (
                store.upsert_document(
                    doc_key=key,
                    doc_type="cv" if key.startswith("cv:") else "job",
                    content_hash=compute_content_hash(text),
                    processed_text=text,
                    updated_at="2026-01-01T00:00:00",
                )
                == "inserted"
            )

        # Unchanged re-upsert is a no-op
        assert (
            store.upsert_document(
                doc_key="cv:1",
                doc_type="cv",
                content_hash=compute_content_hash(batch1["cv:1"]),
                processed_text=batch1["cv:1"],
                updated_at="2026-01-02T00:00:00",
            )
            == "unchanged"
        )

        # Batch 2: INSERT 1 doc + UPDATE cv:2 + DELETE job:1
        assert (
            store.upsert_document(
                doc_key="job:2",
                doc_type="job",
                content_hash=compute_content_hash(
                    "data_scientist python machine_learning pytorch pandas numpy"
                ),
                processed_text="data_scientist python machine_learning pytorch pandas numpy",
                updated_at="2026-01-03T00:00:00",
            )
            == "inserted"
        )
        updated_cv2 = "fullstack_developer react next.js typescript nodejs postgresql"
        assert (
            store.upsert_document(
                doc_key="cv:2",
                doc_type="cv",
                content_hash=compute_content_hash(updated_cv2),
                processed_text=updated_cv2,
                updated_at="2026-01-03T00:00:00",
            )
            == "updated"
        )
        assert store.delete_document("job:1") is True
        assert store.delete_document("job:999") is False

        store.verify_integrity()
        total_docs = store.total_docs()
        term_df = store.read_term_df()

    final_corpus = [
        batch1["cv:1"],
        updated_cv2,
        "data_scientist python machine_learning pytorch pandas numpy",
    ]
    assert total_docs == len(final_corpus)

    hydrated = hydrate_tfidf_vectorizer(
        total_docs=total_docs,
        term_df=term_df,
        min_df=1,
        max_df_fraction=1.0,
    )
    reference = TfidfVectorizer(
        analyzer="word",
        tokenizer=str.split,
        token_pattern=None,
        lowercase=False,
        ngram_range=(1, 1),
        sublinear_tf=True,
        norm="l2",
        use_idf=True,
        smooth_idf=True,
        stop_words=None,
    )
    reference.fit(final_corpus)

    assert hydrated.vocabulary_ == reference.vocabulary_
    np.testing.assert_allclose(hydrated.idf_, reference.idf_, atol=1e-12)

    queries = [
        "java spring_boot postgresql docker",
        "react typescript nodejs",
        "completely_unseen_oov_term",
        "",
    ]
    np.testing.assert_allclose(
        hydrated.transform(queries).toarray(),
        reference.transform(queries).toarray(),
        atol=1e-12,
    )


def test_atomic_pkl_round_trip_and_integrity_guards(
    tmp_path: Path,
    spacy_pipeline: LoadedSpacyPipeline,
) -> None:
    state_path = tmp_path / "df_state.sqlite"
    output_path = tmp_path / "tfidf_model.pkl"
    corpus = [
        "software_engineer java spring_boot postgresql docker",
        "frontend_developer react typescript html css",
    ]
    with IncrementalDfStore(state_path) as store:
        for idx, text in enumerate(corpus, start=1):
            store.upsert_document(
                doc_key=f"cv:{idx}",
                doc_type="cv",
                content_hash=compute_content_hash(text),
                processed_text=text,
                updated_at="2026-01-01T00:00:00",
            )
        vectorizer = hydrate_tfidf_vectorizer(
            total_docs=store.total_docs(),
            term_df=store.read_term_df(),
        )
        payload = build_artifact_payload(
            vectorizer=vectorizer,
            total_docs=store.total_docs(),
            nlp_model_hash=spacy_pipeline.model_hash,
        )

    write_artifact_atomically(payload=payload, output_path=output_path)
    assert output_path.is_file()
    assert output_path.with_suffix(".meta.json").is_file()

    loaded = load_tfidf_artifact(
        output_path,
        expected_nlp_model_hash=spacy_pipeline.model_hash,
    )
    assert loaded.doc_count == 2
    assert loaded.source_kind == "mounted"
    scores = loaded.transform_and_cosine_similarity(
        query_text="java spring_boot docker",
        target_texts=[
            "java spring_boot postgresql docker",
            "react typescript html css",
            "unseen_oov_token_only",
        ],
    )
    assert scores[0] > scores[1] == 0.0
    assert scores[2] == 0.0

    # Fail fast when nlpModelHash mismatches
    with pytest.raises(ConfigurationError, match="nlpModelHash"):
        load_tfidf_artifact(
            output_path,
            expected_nlp_model_hash="0" * 64,
        )

    # Fallback ONLY when mounted file does not exist; corrupt mounted file MUST fail fast
    missing_mounted = tmp_path / "empty_volume" / "tfidf_model.pkl"
    fallback_loaded = load_tfidf_artifact(
        missing_mounted,
        bootstrap_fallback_path=output_path,
        expected_nlp_model_hash=spacy_pipeline.model_hash,
    )
    assert fallback_loaded.source_kind == "bootstrap"

    corrupt_mounted = tmp_path / "corrupt.pkl"
    corrupt_mounted.write_bytes(b"not-a-valid-pickle")
    with pytest.raises(ConfigurationError, match="deserialize"):
        load_tfidf_artifact(
            corrupt_mounted,
            bootstrap_fallback_path=output_path,
        )


def test_bootstrap_csv_ingestion_skips_unchanged_docs_on_second_run(
    tmp_path: Path,
    spacy_pipeline: LoadedSpacyPipeline,
    ai_service_root: Path,
) -> None:
    state_path = tmp_path / "df_state.sqlite"
    bootstrap_dir = ai_service_root / "data" / "bootstrap_raw"

    with IncrementalDfStore(state_path) as store:
        first_stats = ingest_bootstrap_csvs(
            store,
            bootstrap_dir=bootstrap_dir,
            pipeline=spacy_pipeline,
        )
        assert first_stats.inserted == 24
        assert store.count_by_doc_types(BOOTSTRAP_DOC_TYPES) == 24

        # Second run with unchanged CSVs must perform ZERO spaCy NLP calls
        with patch("offline.train_tfidf_incremental.tokenize_english") as mock_tok:
            second_stats = ingest_bootstrap_csvs(
                store,
                bootstrap_dir=bootstrap_dir,
                pipeline=spacy_pipeline,
            )
            assert second_stats.inserted == 0
            assert second_stats.updated == 0
            assert second_stats.unchanged == 24
            mock_tok.assert_not_called()


def test_bootstrap_training_covers_all_canonical_skills_in_vocabulary(
    tmp_path: Path,
    spacy_pipeline: LoadedSpacyPipeline,
    ai_service_root: Path,
) -> None:
    summary = run_training(
        spacy_model_dir=spacy_pipeline.model_dir,
        catalog_path=ai_service_root / "resources" / "skill_catalog.v1.json",
        state_path=tmp_path / "df_state.sqlite",
        output_path=tmp_path / "tfidf_model.pkl",
        bootstrap=True,
        bootstrap_dir=ai_service_root / "data" / "bootstrap_raw",
        force_rebuild=True,
    )
    assert summary["docCount"] == 24
    assert summary["bootstrapDocCount"] == 24
    assert summary["liveDocCount"] == 0

    artifact = load_tfidf_artifact(
        tmp_path / "tfidf_model.pkl",
        expected_nlp_model_hash=spacy_pipeline.model_hash,
    )
    for skill_token in (
        "java",
        "spring_boot",
        "postgresql",
        "docker",
        "kubernetes",
        "c++",
        "c#",
        ".net",
        "ci/cd",
        "nodejs",
        "machine_learning",
        "software_engineer",
    ):
        assert skill_token in artifact.vectorizer.vocabulary_


def test_protected_domain_phrase_survives_min_df_and_cap(
    tmp_path: Path,
    spacy_pipeline: LoadedSpacyPipeline,
    ai_service_root: Path,
) -> None:
    from offline.train_tfidf_incremental import _protected_entity_tokens

    protected = _protected_entity_tokens(
        ai_service_root / "resources" / "skill_catalog.v1.json",
        ai_service_root / "resources" / "domain_phrases.en.json",
    )
    assert "ai_engineer" in protected
    vectorizer = hydrate_tfidf_vectorizer(
        total_docs=100,
        term_df={"experience": 90, "work": 80, "ai_engineer": 1, "cloud_engineer": 1},
        min_df=5,
        max_features=3,
        protected_terms=protected,
    )
    assert vectorizer.ngram_range == (1, 1)
    assert "ai_engineer" in vectorizer.vocabulary_
    assert "cloud_engineer" in vectorizer.vocabulary_
