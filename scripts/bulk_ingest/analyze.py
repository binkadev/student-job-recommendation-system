"""Safe, resumable, idempotent CLI for bulk CV AI analysis (/reanalyze)."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sqlite3
import sys
import threading
import time
from typing import Any, Sequence

from . import DEFAULT_BASE_URL, DEFAULT_PASSWORD, DEFAULT_RUNS_DIR
from .client import (
    BackendIngestClient,
    CvAnalysisResult,
    IngestApiError,
    UnauthorizedSessionError,
)

ANALYZE_PENDING = "PENDING"
ANALYZE_READY = "READY"
ANALYZE_SKIPPED_ALREADY_READY = "SKIPPED_ALREADY_READY"
ANALYZE_FAILED_PERMANENT = "FAILED_PERMANENT"
ANALYZE_FAILED_RETRYABLE = "FAILED_RETRYABLE"

DEFAULT_TARGET_PROCESSING_VERSION = "english-spacy-v1-skills-v1"
DEFAULT_ANALYZE_CONCURRENCY = 2
DEFAULT_ANALYZE_TIMEOUT_SECONDS = 45.0
DEFAULT_ANALYZE_MAX_RETRIES = 3
DEFAULT_FAIL_FAST_THRESHOLD = 10
DEFAULT_ANALYZE_RUN_NAME = "batch-5k"


class AnalyzeManifestMismatchError(ValueError):
    """Raised when analyze_state.sqlite conflicts with source ingest state DB."""


class FatalAbortError(RuntimeError):
    """Raised when fail-fast detects systemic outage or auth/key misconfiguration."""


@dataclass(frozen=True, slots=True)
class AnalyzeTargetItem:
    student_idx: int
    email: str
    user_id: int | None
    cv_id: int
    status: str
    attempts: int


@dataclass(frozen=True, slots=True)
class AnalyzeRunOutcome:
    processed: int
    ready: int
    skipped_already_ready: int
    failed_permanent: int
    failed_retryable: int
    aborted: bool
    abort_reason: str | None
    elapsed_seconds: float
    summary_path: Path
    failures_path: Path


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _configure_utf8_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _build_logger(run_dir: Path, *, write_file_log: bool) -> logging.Logger:
    logger = logging.getLogger("bulk_ingest.analyze")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    if write_file_log:
        run_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(
            run_dir / "analyze_run.log",
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    return logger


def _read_ingest_targets_readonly(ingest_db_path: Path) -> list[tuple[int, str, int | None, int]]:
    if not ingest_db_path.is_file():
        raise FileNotFoundError(f"Ingest state.sqlite not found: {ingest_db_path}")
    conn = sqlite3.connect(f"file:{ingest_db_path}?mode=ro", uri=True)
    try:
        rows = conn.execute(
            """
            SELECT idx, email, user_id, cv_id
            FROM items
            WHERE cv_id IS NOT NULL
            ORDER BY idx ASC
            """
        ).fetchall()
    finally:
        conn.close()
    return [
        (
            int(r[0]),
            str(r[1]),
            None if r[2] is None else int(r[2]),
            int(r[3]),
        )
        for r in rows
    ]


class AnalyzeStateStore:
    """Thread-safe SQLite WAL state store isolated from ingest state.sqlite."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._ensure_schema()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def __enter__(self) -> AnalyzeStateStore:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _ensure_schema(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS analyze_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS cv_analysis_items (
                    student_idx INTEGER PRIMARY KEY,
                    email TEXT NOT NULL,
                    user_id INTEGER,
                    cv_id INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    remote_status TEXT,
                    language_code TEXT,
                    language_confidence REAL,
                    processing_version TEXT,
                    extracted_skill_count INTEGER,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    http_status INTEGER,
                    error_code TEXT,
                    error_message TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_cv_analysis_status
                    ON cv_analysis_items(status);
                """
            )
            self._conn.commit()

    def initialize_or_verify_from_ingest(
        self,
        ingest_db_path: Path,
        *,
        target_processing_version: str,
    ) -> str:
        """Read (idx, email, user_id, cv_id) read-only and initialize/verify analyze_state.sqlite."""
        source_rows = _read_ingest_targets_readonly(ingest_db_path)
        with self._lock:
            existing = self._conn.execute(
                "SELECT student_idx, email, cv_id FROM cv_analysis_items ORDER BY student_idx ASC"
            ).fetchall()
            if not existing:
                now = _utc_now_iso()
                with self._conn:
                    self._conn.executemany(
                        "INSERT OR REPLACE INTO analyze_meta(key, value) VALUES (?, ?)",
                        [
                            ("ingest_state_db", str(ingest_db_path.resolve())),
                            ("target_processing_version", target_processing_version),
                            ("total_targets", str(len(source_rows))),
                            ("created_at", now),
                        ],
                    )
                    self._conn.executemany(
                        """
                        INSERT INTO cv_analysis_items (
                            student_idx, email, user_id, cv_id, status,
                            remote_status, language_code, language_confidence,
                            processing_version, extracted_skill_count, attempts,
                            http_status, error_code, error_message, updated_at
                        ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, ?)
                        """,
                        [
                            (idx, email, user_id, cv_id, ANALYZE_PENDING, now)
                            for idx, email, user_id, cv_id in source_rows
                        ],
                    )
                return "initialized"

            if len(existing) != len(source_rows):
                raise AnalyzeManifestMismatchError(
                    f"Manifest size mismatch: analyze_state={len(existing)} vs ingest={len(source_rows)}"
                )
            for row, (idx, email, _uid, cv_id) in zip(existing, source_rows, strict=True):
                if (
                    int(row["student_idx"]) != idx
                    or str(row["email"]) != email
                    or int(row["cv_id"]) != cv_id
                ):
                    raise AnalyzeManifestMismatchError(
                        f"Manifest shifted at idx={idx}: analyze=({row['email']}, cv={row['cv_id']}) "
                        f"vs ingest=({email}, cv={cv_id})"
                    )
            return "verified"

    def select_items(
        self,
        *,
        retry_failed_only: bool = False,
        force: bool = False,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[AnalyzeTargetItem]:
        """Select actionable rows cleanly using deterministic student_idx slicing first."""
        if offset < 0:
            raise ValueError("offset must be >= 0")
        if limit is not None and limit <= 0:
            raise ValueError("limit must be > 0")

        with self._lock:
            rows = self._conn.execute(
                """
                SELECT student_idx, email, user_id, cv_id, status, attempts
                FROM cv_analysis_items
                ORDER BY student_idx ASC
                """
            ).fetchall()

        sliced = rows[offset:] if limit is None else rows[offset : offset + limit]
        if force:
            selected = sliced
        elif retry_failed_only:
            selected = [r for r in sliced if str(r["status"]) == ANALYZE_FAILED_RETRYABLE]
        else:
            allowed = {ANALYZE_PENDING, ANALYZE_FAILED_RETRYABLE}
            selected = [r for r in sliced if str(r["status"]) in allowed]

        return [
            AnalyzeTargetItem(
                student_idx=int(r["student_idx"]),
                email=str(r["email"]),
                user_id=None if r["user_id"] is None else int(r["user_id"]),
                cv_id=int(r["cv_id"]),
                status=str(r["status"]),
                attempts=int(r["attempts"]),
            )
            for r in selected
        ]

    def mark_success(
        self,
        student_idx: int,
        *,
        local_status: str,
        result: CvAnalysisResult,
        attempts: int,
        http_status: int = 200,
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE cv_analysis_items
                    SET status = ?,
                        remote_status = ?,
                        language_code = ?,
                        language_confidence = ?,
                        processing_version = ?,
                        extracted_skill_count = ?,
                        attempts = ?,
                        http_status = ?,
                        error_code = NULL,
                        error_message = NULL,
                        updated_at = ?
                    WHERE student_idx = ?
                    """,
                    (
                        local_status,
                        result.status,
                        result.language_code,
                        result.language_confidence,
                        result.processing_version,
                        result.extracted_skill_count,
                        attempts,
                        http_status,
                        now,
                        student_idx,
                    ),
                )

    def mark_failure(
        self,
        student_idx: int,
        *,
        retryable: bool,
        attempts: int,
        http_status: int | None,
        error_code: str,
        error_message: str,
        remote_analysis: CvAnalysisResult | None = None,
    ) -> None:
        final_status = (
            ANALYZE_FAILED_RETRYABLE if retryable else ANALYZE_FAILED_PERMANENT
        )
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE cv_analysis_items
                    SET status = ?,
                        remote_status = COALESCE(?, remote_status),
                        language_code = COALESCE(?, language_code),
                        language_confidence = COALESCE(?, language_confidence),
                        processing_version = COALESCE(?, processing_version),
                        extracted_skill_count = COALESCE(?, extracted_skill_count),
                        attempts = ?,
                        http_status = ?,
                        error_code = ?,
                        error_message = ?,
                        updated_at = ?
                    WHERE student_idx = ?
                    """,
                    (
                        final_status,
                        None if remote_analysis is None else remote_analysis.status,
                        None if remote_analysis is None else remote_analysis.language_code,
                        None if remote_analysis is None else remote_analysis.language_confidence,
                        None if remote_analysis is None else remote_analysis.processing_version,
                        None if remote_analysis is None else remote_analysis.extracted_skill_count,
                        attempts,
                        http_status,
                        error_code,
                        error_message[:1000],
                        now,
                        student_idx,
                    ),
                )

    def export_reports(
        self,
        run_dir: Path,
        *,
        elapsed_seconds: float,
        selected_count: int,
        aborted: bool,
        abort_reason: str | None,
    ) -> tuple[Path, Path, dict[str, Any]]:
        run_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            total_in_manifest = int(
                self._conn.execute("SELECT COUNT(*) FROM cv_analysis_items").fetchone()[0]
            )
            status_counts = {
                str(r["status"]): int(r["cnt"])
                for r in self._conn.execute(
                    "SELECT status, COUNT(*) AS cnt FROM cv_analysis_items GROUP BY status"
                ).fetchall()
            }
            language_rows = self._conn.execute(
                """
                SELECT COALESCE(language_code, 'unknown') AS lang, COUNT(*) AS cnt
                FROM cv_analysis_items
                WHERE status IN (?, ?)
                GROUP BY lang
                ORDER BY cnt DESC, lang ASC
                """,
                (ANALYZE_READY, ANALYZE_SKIPPED_ALREADY_READY),
            ).fetchall()
            failure_rows = self._conn.execute(
                """
                SELECT student_idx, email, cv_id, status, remote_status,
                       language_code, language_confidence, attempts,
                       http_status, error_code, error_message, updated_at
                FROM cv_analysis_items
                WHERE status IN (?, ?)
                ORDER BY student_idx ASC
                """,
                (ANALYZE_FAILED_PERMANENT, ANALYZE_FAILED_RETRYABLE),
            ).fetchall()

        throughput = (
            round(selected_count / elapsed_seconds, 2)
            if elapsed_seconds > 0 and selected_count > 0
            else 0.0
        )
        summary_payload = {
            "generatedAt": _utc_now_iso(),
            "elapsedSeconds": round(elapsed_seconds, 2),
            "totalInManifest": total_in_manifest,
            "selectedInInvocation": selected_count,
            "throughputPerSecond": throughput,
            "abortedEarly": aborted,
            "abortReason": abort_reason,
            "statusCounts": {
                ANALYZE_READY: status_counts.get(ANALYZE_READY, 0),
                ANALYZE_SKIPPED_ALREADY_READY: status_counts.get(
                    ANALYZE_SKIPPED_ALREADY_READY, 0
                ),
                ANALYZE_FAILED_PERMANENT: status_counts.get(ANALYZE_FAILED_PERMANENT, 0),
                ANALYZE_FAILED_RETRYABLE: status_counts.get(ANALYZE_FAILED_RETRYABLE, 0),
                ANALYZE_PENDING: status_counts.get(ANALYZE_PENDING, 0),
            },
            "languageBreakdown": {str(r["lang"]): int(r["cnt"]) for r in language_rows},
        }

        summary_path = run_dir / "analyze_summary.json"
        failures_path = run_dir / "analyze_failures.csv"
        summary_path.write_text(
            json.dumps(summary_payload, indent=2) + "\n", encoding="utf-8"
        )

        with failures_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "student_idx",
                    "email",
                    "cv_id",
                    "status",
                    "remote_status",
                    "language_code",
                    "language_confidence",
                    "attempts",
                    "http_status",
                    "error_code",
                    "error_message",
                    "updated_at",
                ]
            )
            for row in failure_rows:
                writer.writerow(
                    [
                        row["student_idx"],
                        row["email"],
                        row["cv_id"],
                        row["status"],
                        row["remote_status"],
                        row["language_code"],
                        row["language_confidence"],
                        row["attempts"],
                        row["http_status"],
                        row["error_code"],
                        row["error_message"],
                        row["updated_at"],
                    ]
                )
        return summary_path, failures_path, summary_payload


class _AbortCoordinator:
    """Thread-safe consecutive transient failure & fatal-auth guard."""

    def __init__(self, *, threshold: int) -> None:
        self.threshold = max(1, threshold)
        self._lock = threading.Lock()
        self.consecutive_transient = 0
        self.abort_event = threading.Event()
        self.abort_reason: str | None = None

    def record_success_or_domain_rejection(self) -> None:
        with self._lock:
            self.consecutive_transient = 0

    def record_transient_failure(self, reason: str) -> None:
        with self._lock:
            self.consecutive_transient += 1
            if (
                self.consecutive_transient >= self.threshold
                and not self.abort_event.is_set()
            ):
                self.abort_reason = (
                    f"Fail-fast triggered after {self.consecutive_transient} consecutive "
                    f"transient failures (last: {reason})"
                )
                self.abort_event.set()

    def trigger_fatal(self, reason: str) -> None:
        with self._lock:
            if not self.abort_event.is_set():
                self.abort_reason = reason
                self.abort_event.set()


def _capture_remote_analysis_safely(
    client: BackendIngestClient,
    *,
    token: str,
    cv_id: int,
) -> CvAnalysisResult | None:
    try:
        return client.get_cv_analysis(token=token, cv_id=cv_id)
    except Exception:
        return None


def process_single_cv(
    item: AnalyzeTargetItem,
    *,
    client: BackendIngestClient,
    store: AnalyzeStateStore,
    coordinator: _AbortCoordinator,
    logger: logging.Logger,
    password: str = DEFAULT_PASSWORD,
    target_processing_version: str = DEFAULT_TARGET_PROCESSING_VERSION,
    force: bool = False,
) -> str:
    if coordinator.abort_event.is_set():
        return "ABORTED"

    attempts = item.attempts + 1
    try:
        token, _ = client.login(email=item.email, password=password)

        # Idempotent skip check unless --force is explicitly supplied
        if not force:
            try:
                existing = client.get_cv_analysis(token=token, cv_id=item.cv_id)
            except UnauthorizedSessionError:
                token, _ = client.login(email=item.email, password=password)
                existing = client.get_cv_analysis(token=token, cv_id=item.cv_id)

            if (
                existing.status == "READY"
                and existing.processing_version == target_processing_version
            ):
                store.mark_success(
                    item.student_idx,
                    local_status=ANALYZE_SKIPPED_ALREADY_READY,
                    result=existing,
                    attempts=attempts,
                )
                coordinator.record_success_or_domain_rejection()
                return ANALYZE_SKIPPED_ALREADY_READY

        # Trigger POST /api/students/me/cv/{cvId}/reanalyze
        try:
            analyzed = client.reanalyze_cv(token=token, cv_id=item.cv_id)
        except UnauthorizedSessionError:
            # Refresh once; if still 401 right after login, treat as fatal config/auth error
            token, _ = client.login(email=item.email, password=password)
            try:
                analyzed = client.reanalyze_cv(token=token, cv_id=item.cv_id)
            except UnauthorizedSessionError as exc:
                reason = (
                    f"Fatal 401 UNAUTHORIZED on POST /api/students/me/cv/{item.cv_id}/reanalyze "
                    f"even with a freshly issued JWT (check auth/internal key configuration)"
                )
                store.mark_failure(
                    item.student_idx,
                    retryable=False,
                    attempts=attempts,
                    http_status=401,
                    error_code="UNAUTHORIZED_FATAL",
                    error_message=reason,
                )
                coordinator.trigger_fatal(reason)
                logger.error(reason)
                raise FatalAbortError(reason) from exc

        if analyzed.status != "READY":
            store.mark_failure(
                item.student_idx,
                retryable=False,
                attempts=attempts,
                http_status=200,
                error_code="UNEXPECTED_ANALYSIS_STATUS",
                error_message=analyzed.analysis_error or f"status={analyzed.status}",
                remote_analysis=analyzed,
            )
            coordinator.record_success_or_domain_rejection()
            return ANALYZE_FAILED_PERMANENT

        store.mark_success(
            item.student_idx,
            local_status=ANALYZE_READY,
            result=analyzed,
            attempts=attempts,
        )
        coordinator.record_success_or_domain_rejection()
        return ANALYZE_READY

    except FatalAbortError:
        return "ABORTED"
    except IngestApiError as exc:
        if exc.http_status == 401:
            reason = f"Fatal 401 UNAUTHORIZED for {item.email} cv_id={item.cv_id}: {exc.message}"
            store.mark_failure(
                item.student_idx,
                retryable=False,
                attempts=attempts,
                http_status=401,
                error_code=exc.error_code,
                error_message=reason,
            )
            coordinator.trigger_fatal(reason)
            logger.error(reason)
            return "ABORTED"

        # 502 AI_SERVICE_INVALID_RESPONSE: AI 4xx domain rejection -> query /analysis to capture analysisError, mark FAILED_PERMANENT
        if exc.http_status == 502 and exc.error_code == "AI_SERVICE_INVALID_RESPONSE":
            remote_analysis: CvAnalysisResult | None = None
            try:
                fresh_tok, _ = client.login(email=item.email, password=password)
                remote_analysis = _capture_remote_analysis_safely(
                    client, token=fresh_tok, cv_id=item.cv_id
                )
            except Exception:
                remote_analysis = None

            detailed_msg = (
                remote_analysis.analysis_error
                if remote_analysis is not None and remote_analysis.analysis_error
                else exc.message
            )
            store.mark_failure(
                item.student_idx,
                retryable=False,
                attempts=attempts,
                http_status=exc.http_status,
                error_code=exc.error_code,
                error_message=detailed_msg,
                remote_analysis=remote_analysis,
            )
            coordinator.record_success_or_domain_rejection()
            logger.warning(
                "idx=%s cv_id=%s permanent code=%s http=%s analysisError=%s",
                item.student_idx,
                item.cv_id,
                exc.error_code,
                exc.http_status,
                detailed_msg,
            )
            return ANALYZE_FAILED_PERMANENT

        store.mark_failure(
            item.student_idx,
            retryable=exc.retryable,
            attempts=attempts,
            http_status=exc.http_status,
            error_code=exc.error_code,
            error_message=exc.message,
        )
        if exc.retryable:
            coordinator.record_transient_failure(
                f"{exc.error_code} HTTP {exc.http_status}: {exc.message}"
            )
        else:
            coordinator.record_success_or_domain_rejection()
        logger.warning(
            "idx=%s cv_id=%s failed retryable=%s code=%s http=%s msg=%s",
            item.student_idx,
            item.cv_id,
            exc.retryable,
            exc.error_code,
            exc.http_status,
            exc.message,
        )
        return ANALYZE_FAILED_RETRYABLE if exc.retryable else ANALYZE_FAILED_PERMANENT
    except Exception as exc:
        store.mark_failure(
            item.student_idx,
            retryable=True,
            attempts=attempts,
            http_status=None,
            error_code=type(exc).__name__,
            error_message=str(exc),
        )
        coordinator.record_transient_failure(f"{type(exc).__name__}: {exc}")
        logger.warning(
            "idx=%s cv_id=%s unexpected=%s msg=%s",
            item.student_idx,
            item.cv_id,
            type(exc).__name__,
            exc,
        )
        return ANALYZE_FAILED_RETRYABLE


def run_cv_analysis(
    *,
    items: list[AnalyzeTargetItem],
    client: BackendIngestClient,
    store: AnalyzeStateStore,
    run_dir: Path,
    concurrency: int,
    logger: logging.Logger,
    password: str = DEFAULT_PASSWORD,
    target_processing_version: str = DEFAULT_TARGET_PROCESSING_VERSION,
    force: bool = False,
    fail_fast_threshold: int = DEFAULT_FAIL_FAST_THRESHOLD,
) -> AnalyzeRunOutcome:
    started = time.perf_counter()
    ready = skipped = permanent = retryable = 0
    total = len(items)
    coordinator = _AbortCoordinator(threshold=fail_fast_threshold)

    if total > 0:
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            futures = [
                executor.submit(
                    process_single_cv,
                    item,
                    client=client,
                    store=store,
                    coordinator=coordinator,
                    logger=logger,
                    password=password,
                    target_processing_version=target_processing_version,
                    force=force,
                )
                for item in items
            ]
            completed = 0
            for future in as_completed(futures):
                outcome = future.result()
                if outcome == "ABORTED":
                    for pending_future in futures:
                        pending_future.cancel()
                    continue
                completed += 1
                if outcome == ANALYZE_READY:
                    ready += 1
                elif outcome == ANALYZE_SKIPPED_ALREADY_READY:
                    skipped += 1
                elif outcome == ANALYZE_FAILED_PERMANENT:
                    permanent += 1
                elif outcome == ANALYZE_FAILED_RETRYABLE:
                    retryable += 1

                if completed % 25 == 0 or completed == total:
                    elapsed_so_far = time.perf_counter() - started
                    rate = completed / elapsed_so_far if elapsed_so_far > 0 else 0.0
                    eta_sec = (total - completed) / rate if rate > 0 else 0.0
                    logger.info(
                        "progress=%d/%d ready=%d skipped=%d permanent=%d retryable=%d "
                        "rate=%.2f/s eta=%.0fs",
                        completed,
                        total,
                        ready,
                        skipped,
                        permanent,
                        retryable,
                        rate,
                        eta_sec,
                    )

    elapsed = time.perf_counter() - started
    summary_path, failures_path, _ = store.export_reports(
        run_dir,
        elapsed_seconds=elapsed,
        selected_count=total,
        aborted=coordinator.abort_event.is_set(),
        abort_reason=coordinator.abort_reason,
    )
    return AnalyzeRunOutcome(
        processed=total,
        ready=ready,
        skipped_already_ready=skipped,
        failed_permanent=permanent,
        failed_retryable=retryable,
        aborted=coordinator.abort_event.is_set(),
        abort_reason=coordinator.abort_reason,
        elapsed_seconds=elapsed,
        summary_path=summary_path,
        failures_path=failures_path,
    )


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.bulk_ingest.analyze",
        description="Safe, resumable, idempotent bulk CV AI analysis (/reanalyze) CLI.",
    )
    parser.add_argument(
        "--ingest-state-db",
        type=Path,
        default=DEFAULT_RUNS_DIR / "batch-5k" / "state.sqlite",
        help="Read-only path to ingest state.sqlite (default: runs/batch-5k/state.sqlite)",
    )
    parser.add_argument(
        "--run-name",
        default=DEFAULT_ANALYZE_RUN_NAME,
        help=f"Run workspace name under --runs-dir for analyze_state.sqlite/logs (default: {DEFAULT_ANALYZE_RUN_NAME})",
    )
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=DEFAULT_RUNS_DIR,
        help=f"Base folder for run artifacts (default: {DEFAULT_RUNS_DIR})",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Backend base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help=f"Student account password (default: {DEFAULT_PASSWORD})",
    )
    parser.add_argument(
        "--target-processing-version",
        default=DEFAULT_TARGET_PROCESSING_VERSION,
        help=f"Skip already-READY CVs matching this processingVersion (default: {DEFAULT_TARGET_PROCESSING_VERSION})",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Slice offset into sorted manifest items (default: 0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum items in this slice (default: all)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_ANALYZE_CONCURRENCY,
        help=f"Concurrent analysis workers (default: {DEFAULT_ANALYZE_CONCURRENCY}; warns if > 3)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_ANALYZE_TIMEOUT_SECONDS,
        help=f"HTTP request timeout in seconds (>= 35, default: {DEFAULT_ANALYZE_TIMEOUT_SECONDS})",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=DEFAULT_ANALYZE_MAX_RETRIES,
        help=f"Max exponential backoff retries for 503/504/408/429/network errors (default: {DEFAULT_ANALYZE_MAX_RETRIES})",
    )
    parser.add_argument(
        "--fail-fast-threshold",
        type=int,
        default=DEFAULT_FAIL_FAST_THRESHOLD,
        help=f"Abort run if consecutive transient failures reach this threshold (default: {DEFAULT_FAIL_FAST_THRESHOLD})",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Process only items currently in FAILED_RETRYABLE state",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reanalyze even rows already marked READY or SKIPPED_ALREADY_READY",
    )
    args = parser.parse_args(argv)
    if args.timeout < 35.0:
        parser.error("--timeout must be >= 35.0 seconds for CV /reanalyze calls")
    return args


def main(argv: Sequence[str] | None = None) -> int:
    _configure_utf8_console()
    args = parse_args(argv)

    run_dir = Path(args.runs_dir) / args.run_name
    logger = _build_logger(run_dir, write_file_log=True)

    if args.concurrency > 3:
        logger.warning(
            "concurrency=%d exceeds 3 while ai-service typically runs --workers 2 under Backend's 15s read timeout; "
            "this may increase 504 AI_SERVICE_TIMEOUT failures.",
            args.concurrency,
        )

    analyze_db_path = run_dir / "analyze_state.sqlite"
    with AnalyzeStateStore(analyze_db_path) as store:
        manifest_state = store.initialize_or_verify_from_ingest(
            args.ingest_state_db,
            target_processing_version=args.target_processing_version,
        )
        items = store.select_items(
            retry_failed_only=args.retry_failed,
            force=args.force,
            offset=args.offset,
            limit=args.limit,
        )
        logger.info(
            "run=%s manifest=%s selected=%d concurrency=%d timeout=%.1fs max_retries=%d "
            "retry_failed=%s force=%s target_version=%s",
            args.run_name,
            manifest_state,
            len(items),
            args.concurrency,
            args.timeout,
            args.max_retries,
            args.retry_failed,
            args.force,
            args.target_processing_version,
        )

        with BackendIngestClient(
            args.base_url,
            concurrency=args.concurrency,
            timeout_seconds=args.timeout,
            max_retries=args.max_retries,
        ) as client:
            client.check_health()
            outcome = run_cv_analysis(
                items=items,
                client=client,
                store=store,
                run_dir=run_dir,
                concurrency=args.concurrency,
                logger=logger,
                password=args.password,
                target_processing_version=args.target_processing_version,
                force=args.force,
                fail_fast_threshold=args.fail_fast_threshold,
            )

    logger.info(
        "finished elapsed=%.2fs processed=%d ready=%d skipped=%d permanent=%d retryable=%d "
        "aborted=%s summary=%s failures=%s",
        outcome.elapsed_seconds,
        outcome.processed,
        outcome.ready,
        outcome.skipped_already_ready,
        outcome.failed_permanent,
        outcome.failed_retryable,
        outcome.aborted,
        outcome.summary_path,
        outcome.failures_path,
    )
    if outcome.aborted:
        logger.error("ABORTED: %s", outcome.abort_reason)
        return 3
    return 0 if outcome.failed_retryable == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
