"""Offline Incremental DF trainer CLI for Global IDF ``tfidf_model.pkl``.

Supports two clean workflows:
1. ``--bootstrap``: Reads raw English CSV files from
   ``ai-service/data/bootstrap_raw/`` (``resumes.csv`` and ``jobs.csv``), runs
   the shared 3-stage English NLP pipeline (stripping any Job ``SKILLS``
   section), updates ``df_state.sqlite`` with ``bootstrap_cv`` /
   ``bootstrap_job`` entries, and exports ``tfidf_model.pkl`` atomically.
2. Incremental PostgreSQL sync (default when ``--database-url`` or
   ``AI_TRAINER_DATABASE_URL`` is supplied): Fetches ONLY newly inserted or
   updated English ``READY`` CVs (reusing persisted ``processed_text`` with
   ZERO spaCy re-processing) and newly inserted/updated ``ACTIVE`` Jobs from
   ``VERIFIED`` companies (running spaCy ONLY when ``content_hash`` changed),
   subtracts deleted/deactivated IDs, applies bootstrap retention policy
   (``--keep-bootstrap`` / ``--drop-bootstrap`` / ``--auto-drop-bootstrap-at``),
   and atomically writes ``tfidf_model.pkl``.

This module is strictly offline; the online FastAPI service NEVER imports it.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import os
from pathlib import Path
import sys
from typing import Any, Sequence

from core.constants import LANGUAGE_CONFIDENCE_THRESHOLD, PROCESSING_VERSION
from nlp.english_pipeline import (
    LoadedSpacyPipeline,
    load_compiled_spacy_pipeline,
    tokenize_english,
)
from nlp.job_document import format_job_source_text, parse_job_document
from nlp.language_detector import detect_language
from nlp.skill_canonicalizer import load_skill_catalog
from offline.build_spacy_model import (
    _load_domain_phrases,
    canonical_to_entity_id,
)
from offline.incremental_df_store import (
    BOOTSTRAP_DOC_TYPES,
    DeltaStats,
    IncrementalDfStore,
    LIVE_DOC_TYPES,
    compute_content_hash,
)
from offline.tfidf_hydrator import (
    DEFAULT_MAX_DF_FRACTION,
    DEFAULT_MAX_FEATURES,
    DEFAULT_NGRAM_RANGE,
    build_artifact_payload,
    hydrate_tfidf_vectorizer,
    write_artifact_atomically,
)
from schemas.common import LanguageCode


_SERVICE_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_BOOTSTRAP_DIR = _SERVICE_ROOT / "data" / "bootstrap_raw"
_DEFAULT_SPACY_MODEL_DIR = _SERVICE_ROOT / "built_models" / "spacy_custom_model"
_DEFAULT_CATALOG_PATH = _SERVICE_ROOT / "resources" / "skill_catalog.v1.json"
_DEFAULT_PHRASES_PATH = _SERVICE_ROOT / "resources" / "domain_phrases.en.json"
_DEFAULT_STATE_PATH = _SERVICE_ROOT / "models" / "tfidf" / "df_state.sqlite"
_DEFAULT_OUTPUT_PATH = _SERVICE_ROOT / "models" / "tfidf" / "tfidf_model.pkl"
_EPOCH_ISO = "1970-01-01T00:00:00"


def _format_job_source_text(
    title: str,
    description: str,
    requirements: str | None,
) -> str:
    return format_job_source_text(title, description, requirements)


def _preprocess_job_if_english(
    source_text: str,
    *,
    pipeline: LoadedSpacyPipeline,
) -> str | None:
    job_doc = parse_job_document(source_text)
    detection = detect_language(job_doc.language_evidence_text)
    if detection.language_code is not LanguageCode.ENGLISH or detection.confidence < 0.65:
        return None
    tokens = tokenize_english(job_doc.similarity_text, nlp=pipeline.nlp)
    return " ".join(tokens) if tokens else None


def _preprocess_cv_if_english(
    raw_text: str,
    *,
    pipeline: LoadedSpacyPipeline,
) -> str | None:
    detection = detect_language(raw_text)
    if detection.language_code is not LanguageCode.ENGLISH or detection.confidence < 0.65:
        return None
    tokens = tokenize_english(raw_text, nlp=pipeline.nlp)
    return " ".join(tokens) if tokens else None


def ingest_bootstrap_csvs(
    store: IncrementalDfStore,
    *,
    bootstrap_dir: Path,
    pipeline: LoadedSpacyPipeline,
) -> DeltaStats:
    """Ingest ``resumes.csv`` and ``jobs.csv`` from ``bootstrap_dir``."""

    resumes_csv = bootstrap_dir / "resumes.csv"
    jobs_csv = bootstrap_dir / "jobs.csv"
    if not resumes_csv.is_file() and not jobs_csv.is_file():
        raise FileNotFoundError(
            f"Expected resumes.csv and/or jobs.csv inside {bootstrap_dir}"
        )

    inserted = updated = unchanged = deleted = 0
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    active_cv_keys: set[str] = set()
    if resumes_csv.is_file():
        with resumes_csv.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                row_id = (row.get("id") or "").strip()
                raw_text = (row.get("raw_text") or "").strip()
                if not row_id or not raw_text:
                    continue
                doc_key = f"bootstrap_cv:{row_id}"
                active_cv_keys.add(doc_key)
                content_hash = compute_content_hash(raw_text)
                if store.get_content_hash(doc_key) == content_hash:
                    unchanged += 1
                    continue
                processed = _preprocess_cv_if_english(raw_text, pipeline=pipeline)
                if not processed:
                    if store.delete_document(doc_key):
                        deleted += 1
                    continue
                outcome = store.upsert_document(
                    doc_key=doc_key,
                    doc_type="bootstrap_cv",
                    content_hash=content_hash,
                    processed_text=processed,
                    updated_at=now_iso,
                    ngram_range=DEFAULT_NGRAM_RANGE,
                )
                if outcome == "inserted":
                    inserted += 1
                elif outcome == "updated":
                    updated += 1
                elif outcome == "deleted":
                    deleted += 1
                else:
                    unchanged += 1

    for stale_key in store.list_doc_keys(doc_type="bootstrap_cv") - active_cv_keys:
        if store.delete_document(stale_key):
            deleted += 1

    active_job_keys: set[str] = set()
    if jobs_csv.is_file():
        with jobs_csv.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                row_id = (row.get("id") or "").strip()
                title = (row.get("title") or "").strip()
                description = (row.get("description") or "").strip()
                requirements = (row.get("requirements") or "").strip()
                if not row_id or (not title and not description):
                    continue
                doc_key = f"bootstrap_job:{row_id}"
                active_job_keys.add(doc_key)
                source_text = _format_job_source_text(title, description, requirements)
                content_hash = compute_content_hash(source_text)
                if store.get_content_hash(doc_key) == content_hash:
                    unchanged += 1
                    continue
                processed = _preprocess_job_if_english(source_text, pipeline=pipeline)
                if not processed:
                    if store.delete_document(doc_key):
                        deleted += 1
                    continue
                outcome = store.upsert_document(
                    doc_key=doc_key,
                    doc_type="bootstrap_job",
                    content_hash=content_hash,
                    processed_text=processed,
                    updated_at=now_iso,
                    ngram_range=DEFAULT_NGRAM_RANGE,
                )
                if outcome == "inserted":
                    inserted += 1
                elif outcome == "updated":
                    updated += 1
                elif outcome == "deleted":
                    deleted += 1
                else:
                    unchanged += 1

    for stale_key in store.list_doc_keys(doc_type="bootstrap_job") - active_job_keys:
        if store.delete_document(stale_key):
            deleted += 1

    return DeltaStats(
        inserted=inserted,
        updated=updated,
        unchanged=unchanged,
        deleted=deleted,
    )


def _format_watermark(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def sync_from_postgres(
    store: IncrementalDfStore,
    *,
    database_url: str,
    pipeline: LoadedSpacyPipeline,
    processing_version: str = PROCESSING_VERSION,
) -> DeltaStats:
    """Incrementally sync new, modified, and deleted English CVs & Jobs."""

    try:
        import psycopg  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError(
            "psycopg is required for PostgreSQL incremental sync; install "
            "requirements-offline.lock or run via the Docker 'trainer' stage."
        ) from error

    last_cv_ts = store.get_meta("last_cv_updated_at", _EPOCH_ISO) or _EPOCH_ISO
    last_cv_id = int(store.get_meta("last_cv_id", "0") or "0")
    last_job_ts = store.get_meta("last_job_updated_at", _EPOCH_ISO) or _EPOCH_ISO
    last_job_id = int(store.get_meta("last_job_id", "0") or "0")

    inserted = updated = unchanged = deleted = 0

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # 1. Incremental CVs: reuse persisted processed_text (ZERO NLP cost).
            cur.execute(
                """
                SELECT id, processed_text, updated_at
                FROM cv_files
                WHERE analysis_status = 'READY'
                  AND language_code = 'en'
                  AND processing_version = %s
                  AND processed_text IS NOT NULL
                  AND BTRIM(processed_text) <> ''
                  AND (
                      updated_at > %s::timestamp
                      OR (updated_at = %s::timestamp AND id > %s)
                  )
                ORDER BY updated_at ASC, id ASC
                """,
                (processing_version, last_cv_ts, last_cv_ts, last_cv_id),
            )
            max_cv_ts, max_cv_id = last_cv_ts, last_cv_id
            for cv_id, processed_text, updated_at in cur.fetchall():
                doc_key = f"cv:{int(cv_id)}"
                ts_str = _format_watermark(updated_at)
                content_hash = compute_content_hash(str(processed_text))
                outcome = store.upsert_document(
                    doc_key=doc_key,
                    doc_type="cv",
                    content_hash=content_hash,
                    processed_text=str(processed_text),
                    updated_at=ts_str,
                    ngram_range=DEFAULT_NGRAM_RANGE,
                )
                if outcome == "inserted":
                    inserted += 1
                elif outcome == "updated":
                    updated += 1
                elif outcome == "deleted":
                    deleted += 1
                else:
                    unchanged += 1
                max_cv_ts, max_cv_id = ts_str, int(cv_id)

            # Lightweight ID-only scan for CV deletions/status regressions.
            cur.execute(
                """
                SELECT id FROM cv_files
                WHERE analysis_status = 'READY'
                  AND language_code = 'en'
                  AND processing_version = %s
                  AND processed_text IS NOT NULL
                  AND BTRIM(processed_text) <> ''
                """,
                (processing_version,),
            )
            active_cv_keys = {f"cv:{int(row[0])}" for row in cur.fetchall()}
            for stale_key in store.list_doc_keys(doc_type="cv") - active_cv_keys:
                if store.delete_document(stale_key):
                    deleted += 1

            store.set_meta("last_cv_updated_at", max_cv_ts)
            store.set_meta("last_cv_id", str(max_cv_id))

            # 2. Incremental Jobs: Zero-NLP fast path when V26 snapshot matches content_hash.
            cur.execute(
                """
                SELECT j.id,
                       j.title,
                       j.description,
                       j.requirements,
                       j.processed_text,
                       j.language_code,
                       j.language_confidence,
                       j.processing_version,
                       j.content_hash,
                       j.updated_at
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                WHERE j.status = 'ACTIVE'
                  AND c.status = 'VERIFIED'
                  AND (
                      j.updated_at > %s::timestamp
                      OR (j.updated_at = %s::timestamp AND j.id > %s)
                  )
                ORDER BY j.updated_at ASC, j.id ASC
                """,
                (last_job_ts, last_job_ts, last_job_id),
            )
            max_job_ts, max_job_id = last_job_ts, last_job_id
            for (
                job_id,
                title,
                description,
                requirements,
                persisted_processed_text,
                persisted_lang_code,
                persisted_lang_conf,
                persisted_version,
                persisted_content_hash,
                updated_at,
            ) in cur.fetchall():
                doc_key = f"job:{int(job_id)}"
                ts_str = _format_watermark(updated_at)
                source_text = _format_job_source_text(
                    str(title or ""),
                    str(description or ""),
                    None if requirements is None else str(requirements),
                )
                content_hash = compute_content_hash(source_text)
                if store.get_content_hash(doc_key) == content_hash:
                    unchanged += 1
                else:
                    has_valid_snapshot = (
                        persisted_version == processing_version
                        and persisted_content_hash == content_hash
                        and persisted_lang_code is not None
                        and persisted_lang_conf is not None
                    )
                    if has_valid_snapshot:
                        if (
                            str(persisted_lang_code) == LanguageCode.ENGLISH.value
                            and float(persisted_lang_conf) >= LANGUAGE_CONFIDENCE_THRESHOLD
                            and persisted_processed_text is not None
                            and str(persisted_processed_text).strip()
                        ):
                            processed: str | None = str(persisted_processed_text).strip()
                        else:
                            processed = None
                    else:
                        processed = _preprocess_job_if_english(
                            source_text,
                            pipeline=pipeline,
                        )
                    if not processed:
                        if store.delete_document(doc_key):
                            deleted += 1
                    else:
                        outcome = store.upsert_document(
                            doc_key=doc_key,
                            doc_type="job",
                            content_hash=content_hash,
                            processed_text=processed,
                            updated_at=ts_str,
                            ngram_range=DEFAULT_NGRAM_RANGE,
                        )
                        if outcome == "inserted":
                            inserted += 1
                        elif outcome == "updated":
                            updated += 1
                        elif outcome == "deleted":
                            deleted += 1
                        else:
                            unchanged += 1
                max_job_ts, max_job_id = ts_str, int(job_id)

            # Lightweight ID-only scan for closed/deleted/unverified Jobs.
            cur.execute(
                """
                SELECT j.id
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                WHERE j.status = 'ACTIVE'
                  AND c.status = 'VERIFIED'
                """
            )
            active_job_keys = {f"job:{int(row[0])}" for row in cur.fetchall()}
            for stale_key in store.list_doc_keys(doc_type="job") - active_job_keys:
                if store.delete_document(stale_key):
                    deleted += 1

            store.set_meta("last_job_updated_at", max_job_ts)
            store.set_meta("last_job_id", str(max_job_id))

    return DeltaStats(
        inserted=inserted,
        updated=updated,
        unchanged=unchanged,
        deleted=deleted,
    )


def _protected_entity_tokens(
    catalog_path: Path,
    phrases_path: Path = _DEFAULT_PHRASES_PATH,
) -> frozenset[str]:
    catalog = load_skill_catalog(catalog_path)
    _version, domain_phrases = _load_domain_phrases(
        phrases_path,
        skill_catalog=catalog,
    )
    skill_tokens = {
        canonical_to_entity_id(skill) for skill in catalog.canonical_skills
    }
    phrase_tokens = {entity_id for entity_id, _aliases in domain_phrases}
    return frozenset(skill_tokens | phrase_tokens)


# Backward-compatible internal alias for existing callers/tests.
_protected_skill_tokens = _protected_entity_tokens


def run_training(
    *,
    spacy_model_dir: Path = _DEFAULT_SPACY_MODEL_DIR,
    catalog_path: Path = _DEFAULT_CATALOG_PATH,
    phrases_path: Path = _DEFAULT_PHRASES_PATH,
    state_path: Path = _DEFAULT_STATE_PATH,
    output_path: Path = _DEFAULT_OUTPUT_PATH,
    bootstrap: bool = False,
    bootstrap_dir: Path = _DEFAULT_BOOTSTRAP_DIR,
    database_url: str | None = None,
    force_rebuild: bool = False,
    drop_bootstrap: bool = False,
    auto_drop_bootstrap_at: int | None = None,
    min_df: int | None = None,
    max_df_fraction: float = DEFAULT_MAX_DF_FRACTION,
    max_features: int = DEFAULT_MAX_FEATURES,
) -> dict[str, object]:
    """Execute one incremental or bootstrap Global IDF training cycle."""

    if not bootstrap and not database_url:
        raise ValueError(
            "Provide --bootstrap and/or --database-url (or AI_TRAINER_DATABASE_URL)"
        )

    pipeline = load_compiled_spacy_pipeline(spacy_model_dir)
    protected_terms = _protected_entity_tokens(catalog_path, phrases_path)

    with IncrementalDfStore(state_path) as store:
        stored_hash = store.get_meta("nlp_model_hash")
        if force_rebuild or (stored_hash is not None and stored_hash != pipeline.model_hash):
            store.reset(nlp_model_hash=pipeline.model_hash)
        elif stored_hash is None:
            store.set_meta("nlp_model_hash", pipeline.model_hash)

        bootstrap_stats = DeltaStats()
        if bootstrap:
            bootstrap_stats = ingest_bootstrap_csvs(
                store,
                bootstrap_dir=bootstrap_dir,
                pipeline=pipeline,
            )

        live_stats = DeltaStats()
        if database_url:
            live_stats = sync_from_postgres(
                store,
                database_url=database_url,
                pipeline=pipeline,
            )

        live_count = store.count_by_doc_types(LIVE_DOC_TYPES)
        should_drop_bootstrap = drop_bootstrap or (
            auto_drop_bootstrap_at is not None and live_count >= auto_drop_bootstrap_at
        )
        dropped_bootstrap = 0
        if should_drop_bootstrap and live_count > 0:
            dropped_bootstrap = store.delete_by_doc_types(BOOTSTRAP_DOC_TYPES)

        bootstrap_count = store.count_by_doc_types(BOOTSTRAP_DOC_TYPES)
        total_docs = store.total_docs()
        store.verify_integrity()
        term_df = store.read_term_df()

    effective_min_df = (
        min_df if min_df is not None else (2 if total_docs >= 50 else 1)
    )
    vectorizer = hydrate_tfidf_vectorizer(
        total_docs=total_docs,
        term_df=term_df,
        ngram_range=DEFAULT_NGRAM_RANGE,
        min_df=effective_min_df,
        max_df_fraction=max_df_fraction,
        max_features=max_features,
        protected_terms=protected_terms,
    )
    payload = build_artifact_payload(
        vectorizer=vectorizer,
        total_docs=total_docs,
        nlp_model_hash=pipeline.model_hash,
        bootstrap_doc_count=bootstrap_count,
        live_doc_count=live_count,
    )
    write_artifact_atomically(payload=payload, output_path=output_path)

    return {
        "modelVersion": payload["modelVersion"],
        "docCount": total_docs,
        "bootstrapDocCount": bootstrap_count,
        "liveDocCount": live_count,
        "vocabSize": payload["vocabSize"],
        "nlpModelHash": pipeline.model_hash,
        "bootstrapDelta": bootstrap_stats,
        "liveDelta": live_stats,
        "droppedBootstrap": dropped_bootstrap,
        "outputPath": str(output_path),
    }


def main(arguments: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bootstrap",
        action="store_true",
        help="Ingest raw English CSVs from --bootstrap-dir into df_state.sqlite",
    )
    parser.add_argument(
        "--bootstrap-dir",
        type=Path,
        default=_DEFAULT_BOOTSTRAP_DIR,
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("AI_TRAINER_DATABASE_URL"),
        help="PostgreSQL connection URL (or set AI_TRAINER_DATABASE_URL)",
    )
    parser.add_argument(
        "--spacy-model-dir",
        type=Path,
        default=Path(
            os.environ.get("AI_SPACY_MODEL_DIR", str(_DEFAULT_SPACY_MODEL_DIR))
        ),
    )
    parser.add_argument(
        "--catalog-path",
        type=Path,
        default=_DEFAULT_CATALOG_PATH,
    )
    parser.add_argument(
        "--phrases-path",
        type=Path,
        default=_DEFAULT_PHRASES_PATH,
    )
    parser.add_argument(
        "--state-path",
        type=Path,
        default=Path(
            os.environ.get("AI_TFIDF_STATE_PATH", str(_DEFAULT_STATE_PATH))
        ),
    )
    parser.add_argument(
        "--output-path",
        type=Path,
        default=Path(
            os.environ.get("AI_TFIDF_MODEL_PATH", str(_DEFAULT_OUTPUT_PATH))
        ),
    )
    parser.add_argument("--force-rebuild", action="store_true")
    bootstrap_policy = parser.add_mutually_exclusive_group()
    bootstrap_policy.add_argument(
        "--keep-bootstrap",
        action="store_true",
        default=True,
        help="Retain bootstrap seed rows during PostgreSQL sync (default)",
    )
    bootstrap_policy.add_argument(
        "--drop-bootstrap",
        action="store_true",
        help="Remove bootstrap seed rows when live PostgreSQL docs exist",
    )
    parser.add_argument(
        "--auto-drop-bootstrap-at",
        type=int,
        default=None,
        help="Auto-drop bootstrap rows once live PostgreSQL doc count reaches N",
    )
    parser.add_argument("--min-df", type=int, default=None)
    parser.add_argument(
        "--max-df-fraction",
        type=float,
        default=DEFAULT_MAX_DF_FRACTION,
    )
    parser.add_argument(
        "--max-features",
        type=int,
        default=DEFAULT_MAX_FEATURES,
    )

    args = parser.parse_args(arguments)
    summary = run_training(
        spacy_model_dir=args.spacy_model_dir,
        catalog_path=args.catalog_path,
        phrases_path=args.phrases_path,
        state_path=args.state_path,
        output_path=args.output_path,
        bootstrap=args.bootstrap,
        bootstrap_dir=args.bootstrap_dir,
        database_url=args.database_url,
        force_rebuild=args.force_rebuild,
        drop_bootstrap=args.drop_bootstrap,
        auto_drop_bootstrap_at=args.auto_drop_bootstrap_at,
        min_df=args.min_df,
        max_df_fraction=args.max_df_fraction,
        max_features=args.max_features,
    )
    print(
        "Global IDF artifact exported: "
        f"version={summary['modelVersion']} docs={summary['docCount']} "
        f"(bootstrap={summary['bootstrapDocCount']}, live={summary['liveDocCount']}) "
        f"vocab={summary['vocabSize']} path={summary['outputPath']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
