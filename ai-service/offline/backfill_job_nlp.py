"""Multi-core resumable CLI to backfill jobs.processed_text snapshots in PostgreSQL."""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
import os
from pathlib import Path
import sys
import time
from typing import Sequence

import psycopg

from core.constants import LANGUAGE_CONFIDENCE_THRESHOLD, PROCESSING_VERSION
from nlp.english_pipeline import LoadedSpacyPipeline, load_compiled_spacy_pipeline, tokenize_english
from nlp.job_document import compute_job_content_hash, format_job_source_text, parse_job_document
from nlp.language_detector import detect_language
from schemas.common import LanguageCode


_SERVICE_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_SPACY_MODEL_DIR = _SERVICE_ROOT / "built_models" / "spacy_custom_model"

_WORKER_PIPELINE: LoadedSpacyPipeline | None = None


def _init_worker(spacy_model_dir: str) -> None:
    global _WORKER_PIPELINE
    _WORKER_PIPELINE = load_compiled_spacy_pipeline(Path(spacy_model_dir))


def _process_one_job(
    row: tuple[int, str, str, str | None],
) -> tuple[int, str | None, str, float, str, str]:
    job_id, title, description, requirements = row
    pipeline = _WORKER_PIPELINE
    if pipeline is None:
        raise RuntimeError("Worker spaCy pipeline is not initialized")

    source_text = format_job_source_text(title, description, requirements)
    content_hash = compute_job_content_hash(title, description, requirements)
    parsed = parse_job_document(source_text)
    detection = detect_language(parsed.language_evidence_text)

    processed_text: str | None = None
    if (
        detection.language_code is LanguageCode.ENGLISH
        and detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
        and parsed.similarity_text
    ):
        tokens = tokenize_english(parsed.similarity_text, nlp=pipeline.nlp)
        if tokens:
            processed_text = " ".join(tokens)

    return (
        int(job_id),
        processed_text,
        detection.language_code.value,
        float(detection.confidence),
        PROCESSING_VERSION,
        content_hash,
    )


def run_backfill(
    *,
    database_url: str,
    spacy_model_dir: Path = _DEFAULT_SPACY_MODEL_DIR,
    workers: int = 4,
    batch_size: int = 200,
    limit: int | None = None,
    force: bool = False,
) -> dict[str, object]:
    """Backfill ACTIVE jobs in PostgreSQL using parallel worker processes."""

    if not database_url:
        raise ValueError("Provide --database-url or AI_TRAINER_DATABASE_URL")
    if workers < 1:
        raise ValueError("--workers must be at least 1")
    if batch_size < 1:
        raise ValueError("--batch-size must be at least 1")
    if limit is not None and limit < 1:
        raise ValueError("--limit must be positive")

    started = time.perf_counter()
    where_clause = (
        "status = 'ACTIVE'"
        if force
        else (
            "status = 'ACTIVE' AND ("
            "processing_version IS DISTINCT FROM %s "
            "OR content_hash IS NULL "
            "OR language_code IS NULL "
            "OR language_confidence IS NULL)"
        )
    )
    count_params = () if force else (PROCESSING_VERSION,)

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM jobs WHERE {where_clause}", count_params)
            total_eligible = int(cur.fetchone()[0])

    target_total = total_eligible if limit is None else min(total_eligible, limit)
    print(
        f"Starting job NLP backfill: target={target_total} (eligible={total_eligible}), "
        f"workers={workers}, batch_size={batch_size}, force={force}",
        flush=True,
    )
    if target_total == 0:
        return {
            "processed": 0,
            "enReady": 0,
            "nonEnFallback": 0,
            "elapsedSeconds": 0.0,
        }

    processed = 0
    en_ready = 0
    non_en_fallback = 0
    last_id = 0

    with (
        psycopg.connect(database_url) as conn,
        ProcessPoolExecutor(
            max_workers=workers,
            initializer=_init_worker,
            initargs=(str(spacy_model_dir),),
        ) as pool,
    ):
        while processed < target_total:
            remaining = target_total - processed
            fetch_limit = min(batch_size, remaining)
            with conn.cursor() as cur:
                query_params = (
                    (last_id, fetch_limit)
                    if force
                    else (PROCESSING_VERSION, last_id, fetch_limit)
                )
                cur.execute(
                    f"""
                    SELECT id, title, description, requirements
                    FROM jobs
                    WHERE {where_clause}
                      AND id > %s
                    ORDER BY id ASC
                    LIMIT %s
                    """,
                    query_params,
                )
                rows = [
                    (
                        int(row[0]),
                        str(row[1] or ""),
                        str(row[2] or ""),
                        None if row[3] is None else str(row[3]),
                    )
                    for row in cur.fetchall()
                ]

            if not rows:
                break

            last_id = rows[-1][0]
            results = list(pool.map(_process_one_job, rows))
            analyzed_at = datetime.now(timezone.utc).replace(tzinfo=None)

            update_params = []
            for job_id, processed_text, lang_code, lang_conf, version, c_hash in results:
                if lang_code == "en" and lang_conf >= LANGUAGE_CONFIDENCE_THRESHOLD and processed_text:
                    en_ready += 1
                else:
                    non_en_fallback += 1
                update_params.append(
                    (
                        processed_text,
                        lang_code,
                        round(lang_conf, 4),
                        version,
                        c_hash,
                        analyzed_at,
                        job_id,
                    )
                )

            with conn.cursor() as cur:
                cur.executemany(
                    """
                    UPDATE jobs
                    SET processed_text = %s,
                        language_code = %s,
                        language_confidence = %s,
                        processing_version = %s,
                        content_hash = %s,
                        analyzed_at = %s
                    WHERE id = %s
                    """,
                    update_params,
                )
            conn.commit()

            processed += len(results)
            elapsed = max(time.perf_counter() - started, 1e-6)
            rate = processed / elapsed
            eta = (target_total - processed) / rate if rate > 0 else 0.0
            print(
                f"progress={processed}/{target_total} en_ready={en_ready} "
                f"non_en_fallback={non_en_fallback} rate={rate:.2f} jobs/s eta={eta:.1f}s",
                flush=True,
            )

    total_elapsed = round(time.perf_counter() - started, 2)
    return {
        "processed": processed,
        "enReady": en_ready,
        "nonEnFallback": non_en_fallback,
        "elapsedSeconds": total_elapsed,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        default=os.environ.get("AI_TRAINER_DATABASE_URL"),
        help="PostgreSQL connection URL (or set AI_TRAINER_DATABASE_URL)",
    )
    parser.add_argument(
        "--spacy-model-dir",
        type=Path,
        default=Path(os.environ.get("AI_SPACY_MODEL_DIR", str(_DEFAULT_SPACY_MODEL_DIR))),
    )
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")

    args = parser.parse_args(argv)
    summary = run_backfill(
        database_url=args.database_url,
        spacy_model_dir=args.spacy_model_dir,
        workers=args.workers,
        batch_size=args.batch_size,
        limit=args.limit,
        force=args.force,
    )
    print(
        "Backfill complete: "
        f"processed={summary['processed']} en_ready={summary['enReady']} "
        f"non_en_fallback={summary['nonEnFallback']} elapsed={summary['elapsedSeconds']}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
