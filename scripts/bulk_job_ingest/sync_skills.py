"""Safe, resumable API-based Canonical Skill & job_skills Re-Sync CLI."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import sqlite3
import sys
import threading
import time
from typing import Any, Sequence

from . import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_BASE_URL,
    DEFAULT_MAX_RETRIES,
    DEFAULT_RUNS_DIR,
    DEFAULT_SKILL_CATALOG_PATH,
    DEFAULT_TIMEOUT_SECONDS,
)
from .client import BackendJobIngestClient, JobIngestApiError
from .skill_matcher import (
    CanonicalSkillMatcher,
    _normalize_skill_name,
    fetch_catalog_skill_map,
    sync_catalog_skills,
)

SYNC_PENDING = "PENDING"
SYNC_EXPIRED = "EXPIRED"
SYNC_DRAFTED = "DRAFTED"
SYNC_UPDATED = "UPDATED"
SYNC_SUBMITTED = "SUBMITTED"
SYNC_ACTIVE = "ACTIVE"
SYNC_SKIPPED_UNCHANGED = "SKIPPED_UNCHANGED"
SYNC_SKIPPED_NON_ACTIVE = "SKIPPED_NON_ACTIVE"
SYNC_FAILED_RETRYABLE = "FAILED_RETRYABLE"
SYNC_FAILED_PERMANENT = "FAILED_PERMANENT"

_IN_FLIGHT_STATES = (
    SYNC_PENDING,
    SYNC_EXPIRED,
    SYNC_DRAFTED,
    SYNC_UPDATED,
    SYNC_SUBMITTED,
)

DEFAULT_SKILL_CONCURRENCY = 6
DEFAULT_JOB_SYNC_CONCURRENCY = 6
DEFAULT_SKILL_CATEGORY = "IT"
DEFAULT_RESYNC_RUN_NAME = "skills-resync-default"
MAX_SKILLS_PER_JOB = 100


class SyncManifestMismatchError(ValueError):
    """Raised when an existing resync state.sqlite conflicts with current config."""


@dataclass(frozen=True, slots=True)
class SyncJobItem:
    job_id: int
    seq_idx: int
    status: str
    attempts: int


@dataclass(frozen=True, slots=True)
class SyncRunOutcome:
    processed: int
    updated_active: int
    skipped_unchanged: int
    skipped_non_active: int
    failed_retryable: int
    failed_permanent: int
    elapsed_seconds: float


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
    logger = logging.getLogger("bulk_job_ingest.sync_skills")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    logger.addHandler(console)

    if write_file_log:
        run_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(run_dir / "run.log", encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    return logger


class SkillResyncStateStore:
    """Thread-safe SQLite WAL state store for job_skills resynchronization."""

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

    def __enter__(self) -> SkillResyncStateStore:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _ensure_schema(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sync_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS job_sync (
                    job_id INTEGER PRIMARY KEY,
                    seq_idx INTEGER NOT NULL UNIQUE,
                    status TEXT NOT NULL,
                    last_remote_status TEXT,
                    old_skill_count INTEGER,
                    new_skill_count INTEGER,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_http_status INTEGER,
                    last_error_code TEXT,
                    last_error_msg TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_job_sync_status ON job_sync(status);
                CREATE INDEX IF NOT EXISTS idx_job_sync_seq_idx ON job_sync(seq_idx);
                """
            )
            self._conn.commit()

    def initialize_or_resume_jobs(
        self,
        job_ids_supplier: Any,
        *,
        source_mode: str,
        catalog_sha256: str,
        skill_category: str,
    ) -> str:
        """Lock job_id snapshot once or verify an existing resync state database."""
        with self._lock:
            existing_count = self._conn.execute(
                "SELECT COUNT(*) FROM job_sync"
            ).fetchone()[0]
            if existing_count > 0:
                meta = {
                    row["key"]: row["value"]
                    for row in self._conn.execute("SELECT key, value FROM sync_meta").fetchall()
                }
                locked_sha = meta.get("catalog_sha256")
                if locked_sha and locked_sha != catalog_sha256:
                    raise SyncManifestMismatchError(
                        f"Catalog SHA-256 mismatch: locked={locked_sha} vs current={catalog_sha256}. "
                        "Use a new --run-name."
                    )
                return "resumed"

            job_ids = list(job_ids_supplier())
            now = _utc_now_iso()
            with self._conn:
                meta_rows = [
                    ("source_mode", source_mode),
                    ("catalog_sha256", catalog_sha256),
                    ("skill_category", skill_category),
                    ("initialized_at", now),
                    ("total_jobs", str(len(job_ids))),
                ]
                self._conn.executemany(
                    "INSERT OR REPLACE INTO sync_meta(key, value) VALUES (?, ?)",
                    meta_rows,
                )
                self._conn.executemany(
                    """
                    INSERT INTO job_sync (
                        job_id, seq_idx, status, last_remote_status,
                        old_skill_count, new_skill_count, attempts,
                        last_http_status, last_error_code, last_error_msg, updated_at
                    ) VALUES (?, ?, ?, NULL, NULL, NULL, 0, NULL, NULL, NULL, ?)
                    """,
                    [
                        (job_id, seq_idx, SYNC_PENDING, now)
                        for seq_idx, job_id in enumerate(job_ids)
                    ],
                )
            return "initialized"

    def select_jobs(
        self,
        *,
        retry_failed_only: bool = False,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[SyncJobItem]:
        statuses = (
            (
                SYNC_FAILED_RETRYABLE,
                SYNC_EXPIRED,
                SYNC_DRAFTED,
                SYNC_UPDATED,
                SYNC_SUBMITTED,
            )
            if retry_failed_only
            else _IN_FLIGHT_STATES
        )
        placeholders = ",".join("?" for _ in statuses)
        sql = (
            f"SELECT job_id, seq_idx, status, attempts FROM job_sync "
            f"WHERE status IN ({placeholders}) ORDER BY seq_idx ASC"
        )
        params: list[Any] = list(statuses)
        if limit is not None:
            sql += " LIMIT ? OFFSET ?"
            params.extend([max(0, limit), max(0, offset)])
        elif offset > 0:
            sql += " LIMIT -1 OFFSET ?"
            params.append(offset)

        with self._lock:
            rows = self._conn.execute(sql, params).fetchall()
        return [
            SyncJobItem(
                job_id=int(row["job_id"]),
                seq_idx=int(row["seq_idx"]),
                status=str(row["status"]),
                attempts=int(row["attempts"]),
            )
            for row in rows
        ]

    def mark_step(
        self,
        job_id: int,
        *,
        status: str,
        remote_status: str,
        old_skill_count: int | None = None,
        new_skill_count: int | None = None,
        attempts: int | None = None,
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE job_sync
                    SET status = ?,
                        last_remote_status = ?,
                        old_skill_count = COALESCE(?, old_skill_count),
                        new_skill_count = COALESCE(?, new_skill_count),
                        attempts = COALESCE(?, attempts),
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE job_id = ?
                    """,
                    (
                        status,
                        remote_status,
                        old_skill_count,
                        new_skill_count,
                        attempts,
                        now,
                        job_id,
                    ),
                )

    def mark_failed(
        self,
        job_id: int,
        *,
        retryable: bool,
        attempts: int,
        remote_status: str | None = None,
        http_status: int | None,
        error_code: str,
        error_msg: str,
    ) -> None:
        final_status = SYNC_FAILED_RETRYABLE if retryable else SYNC_FAILED_PERMANENT
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE job_sync
                    SET status = ?,
                        last_remote_status = COALESCE(?, last_remote_status),
                        attempts = ?,
                        last_http_status = ?,
                        last_error_code = ?,
                        last_error_msg = ?,
                        updated_at = ?
                    WHERE job_id = ?
                    """,
                    (
                        final_status,
                        remote_status,
                        attempts,
                        http_status,
                        error_code,
                        error_msg[:500],
                        now,
                        job_id,
                    ),
                )

    def count_by_status(self) -> dict[str, int]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT status, COUNT(*) AS cnt FROM job_sync GROUP BY status"
            ).fetchall()
        return {str(row["status"]): int(row["cnt"]) for row in rows}

    def export_reports(
        self,
        run_dir: Path,
        *,
        elapsed_seconds: float,
        skill_counts: dict[str, int] | None = None,
    ) -> tuple[Path, Path]:
        run_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            status_counts = {
                str(r["status"]): int(r["cnt"])
                for r in self._conn.execute(
                    "SELECT status, COUNT(*) AS cnt FROM job_sync GROUP BY status"
                ).fetchall()
            }
            failure_rows = self._conn.execute(
                """
                SELECT job_id, seq_idx, status, last_remote_status, attempts,
                       last_http_status, last_error_code, last_error_msg, updated_at
                FROM job_sync
                WHERE status IN (?, ?)
                ORDER BY seq_idx ASC
                """,
                (SYNC_FAILED_RETRYABLE, SYNC_FAILED_PERMANENT),
            ).fetchall()

        summary_path = run_dir / "summary.json"
        failures_path = run_dir / "failures.csv"

        summary_payload = {
            "generatedAt": _utc_now_iso(),
            "elapsedSeconds": round(elapsed_seconds, 2),
            "skills": skill_counts or {},
            "jobsByStatus": status_counts,
        }
        summary_path.write_text(
            json.dumps(summary_payload, indent=2) + "\n", encoding="utf-8"
        )

        with failures_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "job_id",
                    "seq_idx",
                    "status",
                    "last_remote_status",
                    "attempts",
                    "last_http_status",
                    "last_error_code",
                    "last_error_msg",
                    "updated_at",
                ]
            )
            for r in failure_rows:
                writer.writerow(
                    [
                        r["job_id"],
                        r["seq_idx"],
                        r["status"],
                        r["last_remote_status"],
                        r["attempts"],
                        r["last_http_status"],
                        r["last_error_code"],
                        r["last_error_msg"],
                        r["updated_at"],
                    ]
                )
        return summary_path, failures_path


def _load_job_ids_from_api(
    client: BackendJobIngestClient,
    *,
    status: str = "ACTIVE",
) -> list[int]:
    """Snapshot all target job IDs once via GET /api/jobs?status=ACTIVE before mutations."""
    job_ids: list[int] = []
    seen: set[int] = set()
    page = 1
    while True:
        items, total_pages = client.list_jobs_page_as_admin(
            status=status, page=page, size=100
        )
        for row in items:
            raw_id = row.get("id")
            if raw_id is None:
                continue
            jid = int(raw_id)
            if jid not in seen:
                seen.add(jid)
                job_ids.append(jid)
        if page >= max(1, total_pages):
            break
        page += 1
    job_ids.sort()
    return job_ids


def _load_job_ids_from_ingest_sqlite(db_path: Path) -> list[int]:
    if not db_path.is_file():
        raise FileNotFoundError(f"Ingest state.sqlite not found: {db_path}")
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        rows = conn.execute(
            "SELECT job_id FROM jobs WHERE job_id IS NOT NULL AND status = 'ACTIVE' ORDER BY job_row_idx ASC"
        ).fetchall()
    finally:
        conn.close()
    return [int(row[0]) for row in rows]


def _extract_desired_skill_ids(
    *,
    title: str,
    description: str,
    requirements: str | None,
    matcher: CanonicalSkillMatcher,
    skill_id_map: dict[str, int],
) -> tuple[list[int], int]:
    combined = "\n".join(part for part in (title, description, requirements or "") if part)
    raw_matched = matcher.extract_canonical_skills(combined, limit=5000)
    raw_count = len(raw_matched)
    # Approved deterministic <= 100 cap: sorted(extracted)[:100]
    capped_names = sorted(raw_matched)[:MAX_SKILLS_PER_JOB]
    desired_ids: list[int] = []
    for canonical in capped_names:
        norm = _normalize_skill_name(canonical)
        if norm not in skill_id_map:
            raise RuntimeError(f"Missing synced skillId in Backend for canonical {canonical!r}")
        desired_ids.append(skill_id_map[norm])
    return desired_ids, raw_count


def _build_skills_update_payload(
    desired_ids: list[int],
    live_skills: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], set[int]]:
    live_meta: dict[int, tuple[str, str | None]] = {}
    for row in live_skills:
        raw_sid = row.get("skillId")
        if raw_sid is None:
            continue
        sid = int(raw_sid)
        importance = str(row.get("importance") or "REQUIRED")
        raw_level = row.get("minLevel")
        min_level = str(raw_level) if isinstance(raw_level, str) and raw_level else None
        live_meta[sid] = (importance, min_level)

    payload: list[dict[str, Any]] = []
    for sid in sorted(set(desired_ids)):
        importance, min_level = live_meta.get(sid, ("REQUIRED", None))
        entry: dict[str, Any] = {"skillId": sid, "importance": importance}
        if min_level is not None:
            entry["minLevel"] = min_level
        payload.append(entry)
    return payload, set(live_meta.keys())


def _sync_single_job(
    item: SyncJobItem,
    *,
    client: BackendJobIngestClient,
    store: SkillResyncStateStore,
    matcher: CanonicalSkillMatcher,
    skill_id_map: dict[str, int],
    logger: logging.Logger,
) -> str:
    attempts = item.attempts + 1
    remote_status: str | None = None

    try:
        detail = client.get_job_detail_as_admin(job_id=item.job_id)
        remote_status = str(detail.get("status") or "")
        live_skills = list(detail.get("skills") or [])

        desired_ids, raw_count = _extract_desired_skill_ids(
            title=str(detail.get("title") or ""),
            description=str(detail.get("description") or ""),
            requirements=detail.get("requirements"),
            matcher=matcher,
            skill_id_map=skill_id_map,
        )
        if raw_count > MAX_SKILLS_PER_JOB:
            logger.info(
                "job_id=%s matched=%d exceeded %d; capped deterministically to %d",
                item.job_id,
                raw_count,
                MAX_SKILLS_PER_JOB,
                len(desired_ids),
            )

        skills_payload, current_id_set = _build_skills_update_payload(
            desired_ids, live_skills
        )
        desired_id_set = set(desired_ids)
        old_cnt = len(current_id_set)
        new_cnt = len(desired_id_set)

        # Terminal check / Diff-Skip when job is already ACTIVE and skills match
        if remote_status == "ACTIVE" and current_id_set == desired_id_set:
            if item.status == SYNC_SUBMITTED:
                store.mark_step(
                    item.job_id,
                    status=SYNC_ACTIVE,
                    remote_status="ACTIVE",
                    old_skill_count=old_cnt,
                    new_skill_count=new_cnt,
                    attempts=attempts,
                )
                return SYNC_ACTIVE
            store.mark_step(
                item.job_id,
                status=SYNC_SKIPPED_UNCHANGED,
                remote_status="ACTIVE",
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
                attempts=attempts,
            )
            return SYNC_SKIPPED_UNCHANGED

        # Safeguard: never reopen manually CLOSED or REJECTED untouched jobs
        if remote_status in ("CLOSED", "REJECTED") and item.status in (
            SYNC_PENDING,
            SYNC_FAILED_RETRYABLE,
            SYNC_FAILED_PERMANENT,
        ):
            store.mark_step(
                item.job_id,
                status=SYNC_SKIPPED_NON_ACTIVE,
                remote_status=remote_status,
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
                attempts=attempts,
            )
            return SYNC_SKIPPED_NON_ACTIVE

        # Step 1: ACTIVE -> EXPIRED (Path A preserves publishedAt, never sets closedAt)
        if remote_status == "ACTIVE":
            remote_status = client.update_job_status_as_admin(
                job_id=item.job_id, status="EXPIRED"
            )
            store.mark_step(
                item.job_id,
                status=SYNC_EXPIRED,
                remote_status=remote_status,
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
            )

        # Edge safeguard: if PENDING_APPROVAL still has stale skills, return to DRAFT first
        if remote_status == "PENDING_APPROVAL" and current_id_set != desired_id_set:
            remote_status = client.update_job_status_as_admin(
                job_id=item.job_id, status="DRAFT"
            )
            store.mark_step(
                item.job_id,
                status=SYNC_DRAFTED,
                remote_status=remote_status,
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
            )

        # Step 2: EXPIRED / CLOSED -> DRAFT
        if remote_status in ("EXPIRED", "CLOSED"):
            remote_status = client.update_job_status_as_admin(
                job_id=item.job_id, status="DRAFT"
            )
            store.mark_step(
                item.job_id,
                status=SYNC_DRAFTED,
                remote_status=remote_status,
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
            )

        # Step 3: While in DRAFT, execute PUT {"skills": [...]} (skip PUT if already applied!)
        if remote_status == "DRAFT":
            if current_id_set == desired_id_set:
                store.mark_step(
                    item.job_id,
                    status=SYNC_UPDATED,
                    remote_status="DRAFT",
                    old_skill_count=old_cnt,
                    new_skill_count=new_cnt,
                )
            else:
                client.update_job_as_admin(
                    job_id=item.job_id,
                    payload={"skills": skills_payload},
                )
                store.mark_step(
                    item.job_id,
                    status=SYNC_UPDATED,
                    remote_status="DRAFT",
                    old_skill_count=old_cnt,
                    new_skill_count=new_cnt,
                )

            # Step 4: DRAFT -> PENDING_APPROVAL
            remote_status = client.update_job_status_as_admin(
                job_id=item.job_id, status="PENDING_APPROVAL"
            )
            store.mark_step(
                item.job_id,
                status=SYNC_SUBMITTED,
                remote_status=remote_status,
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
            )

        # Step 5: PENDING_APPROVAL -> ACTIVE
        if remote_status == "PENDING_APPROVAL":
            remote_status = client.update_job_status_as_admin(
                job_id=item.job_id, status="ACTIVE"
            )
            store.mark_step(
                item.job_id,
                status=SYNC_ACTIVE,
                remote_status=remote_status,
                old_skill_count=old_cnt,
                new_skill_count=new_cnt,
                attempts=attempts,
            )
            return SYNC_ACTIVE

        raise JobIngestApiError(
            http_status=None,
            error_code="UNEXPECTED_JOB_STATUS",
            message=f"Job id={item.job_id} stayed in unexpected status {remote_status!r}",
            retryable=False,
        )

    except JobIngestApiError as exc:
        store.mark_failed(
            item.job_id,
            retryable=exc.retryable,
            attempts=attempts,
            remote_status=remote_status,
            http_status=exc.http_status,
            error_code=exc.error_code,
            error_msg=exc.message,
        )
        logger.warning(
            "job_id=%s failed retryable=%s code=%s http=%s msg=%s",
            item.job_id,
            exc.retryable,
            exc.error_code,
            exc.http_status,
            exc.message,
        )
        return SYNC_FAILED_RETRYABLE if exc.retryable else SYNC_FAILED_PERMANENT
    except Exception as exc:
        store.mark_failed(
            item.job_id,
            retryable=True,
            attempts=attempts,
            remote_status=remote_status,
            http_status=None,
            error_code=type(exc).__name__,
            error_msg=str(exc),
        )
        logger.warning(
            "job_id=%s unexpected=%s msg=%s",
            item.job_id,
            type(exc).__name__,
            exc,
        )
        return SYNC_FAILED_RETRYABLE


def run_job_resync_phase(
    *,
    jobs: list[SyncJobItem],
    client: BackendJobIngestClient,
    store: SkillResyncStateStore,
    matcher: CanonicalSkillMatcher,
    skill_id_map: dict[str, int],
    concurrency: int,
    logger: logging.Logger,
) -> SyncRunOutcome:
    started = time.perf_counter()
    updated_active = skipped_unchanged = skipped_non_active = retryable = permanent = 0
    total = len(jobs)
    if total > 0:
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            futures = [
                executor.submit(
                    _sync_single_job,
                    job,
                    client=client,
                    store=store,
                    matcher=matcher,
                    skill_id_map=skill_id_map,
                    logger=logger,
                )
                for job in jobs
            ]
            done = 0
            for future in as_completed(futures):
                result = future.result()
                done += 1
                if result == SYNC_ACTIVE:
                    updated_active += 1
                elif result == SYNC_SKIPPED_UNCHANGED:
                    skipped_unchanged += 1
                elif result == SYNC_SKIPPED_NON_ACTIVE:
                    skipped_non_active += 1
                elif result == SYNC_FAILED_RETRYABLE:
                    retryable += 1
                else:
                    permanent += 1
                if done % 250 == 0 or done == total:
                    elapsed = time.perf_counter() - started
                    rate = done / elapsed if elapsed > 0 else 0.0
                    logger.info(
                        "jobs_resync_progress=%d/%d active=%d unchanged=%d non_active=%d "
                        "retryable=%d permanent=%d rate=%.2f/s",
                        done,
                        total,
                        updated_active,
                        skipped_unchanged,
                        skipped_non_active,
                        retryable,
                        permanent,
                        rate,
                    )
    return SyncRunOutcome(
        processed=total,
        updated_active=updated_active,
        skipped_unchanged=skipped_unchanged,
        skipped_non_active=skipped_non_active,
        failed_retryable=retryable,
        failed_permanent=permanent,
        elapsed_seconds=time.perf_counter() - started,
    )


def _run_dry_run(
    *,
    args: argparse.Namespace,
    matcher: CanonicalSkillMatcher,
    client: BackendJobIngestClient,
) -> dict[str, Any]:
    admin_token = client.get_admin_token()
    existing_skill_map = fetch_catalog_skill_map(client, admin_token=admin_token)
    missing_skills = [
        canonical
        for canonical in matcher.canonical_names
        if _normalize_skill_name(canonical) not in existing_skill_map
    ]

    report: dict[str, Any] = {
        "catalogCanonicals": len(matcher.canonical_names),
        "existingSkillsInDb": len(existing_skill_map),
        "missingSkillsToCreate": len(missing_skills),
        "phase": args.phase,
        "source": args.source,
    }

    if args.phase in ("jobs", "all"):
        counts: list[int] = []
        changed = 0
        unchanged = 0
        over_100 = 0
        total_candidates = 0

        if args.source == "state-db":
            if not args.ingest_state_db.is_file():
                raise FileNotFoundError(f"Ingest state.sqlite not found: {args.ingest_state_db}")
            conn = sqlite3.connect(f"file:{args.ingest_state_db}?mode=ro", uri=True)
            try:
                sql = (
                    "SELECT job_id, title, description, requirements, extracted_skills_json "
                    "FROM jobs WHERE job_id IS NOT NULL AND status = 'ACTIVE' ORDER BY job_row_idx ASC"
                )
                params: list[Any] = []
                if args.limit is not None:
                    sql += " LIMIT ? OFFSET ?"
                    params.extend([max(0, args.limit), max(0, args.offset)])
                elif args.offset > 0:
                    sql += " LIMIT -1 OFFSET ?"
                    params.append(args.offset)
                rows = conn.execute(sql, params).fetchall()
            finally:
                conn.close()

            total_candidates = len(rows)
            for row in rows:
                combined = "\n".join(p for p in (row[1], row[2], row[3] or "") if p)
                raw_new = matcher.extract_canonical_skills(combined, limit=5000)
                if len(raw_new) > MAX_SKILLS_PER_JOB:
                    over_100 += 1
                capped = sorted(raw_new)[:MAX_SKILLS_PER_JOB]
                counts.append(len(capped))
                old_names = sorted(_normalize_skill_name(s) for s in json.loads(row[4]))
                if capped != old_names:
                    changed += 1
                else:
                    unchanged += 1
        else:
            all_ids = _load_job_ids_from_api(client, status="ACTIVE")
            selected_ids = (
                all_ids[args.offset :]
                if args.limit is None
                else all_ids[args.offset : args.offset + args.limit]
            )
            total_candidates = len(selected_ids)

            def _inspect_one(jid: int) -> tuple[bool, int, bool]:
                detail = client.get_job_detail_as_admin(job_id=jid)
                combined = "\n".join(
                    p
                    for p in (
                        str(detail.get("title") or ""),
                        str(detail.get("description") or ""),
                        str(detail.get("requirements") or ""),
                    )
                    if p
                )
                raw_new = matcher.extract_canonical_skills(combined, limit=5000)
                capped = sorted(raw_new)[:MAX_SKILLS_PER_JOB]
                live_norm_set = {
                    _normalize_skill_name(str(s.get("normalizedName") or s.get("skillName") or ""))
                    for s in (detail.get("skills") or [])
                    if isinstance(s, dict)
                }
                return set(capped) != live_norm_set, len(capped), len(raw_new) > MAX_SKILLS_PER_JOB

            with ThreadPoolExecutor(max_workers=max(1, args.job_concurrency)) as executor:
                for is_changed, cnt, hit_over_100 in executor.map(_inspect_one, selected_ids):
                    counts.append(cnt)
                    if is_changed:
                        changed += 1
                    else:
                        unchanged += 1
                    if hit_over_100:
                        over_100 += 1

        report.update(
            {
                "selectedJobs": total_candidates,
                "jobsNeedingUpdate": changed,
                "jobsSkippedUnchanged": unchanged,
                "minMatchedSkills": min(counts) if counts else 0,
                "avgMatchedSkills": round(sum(counts) / len(counts), 2) if counts else 0.0,
                "maxMatchedSkills": max(counts) if counts else 0,
                "jobsExceeding100Cap": over_100,
            }
        )

    print("=== Skill Catalog & job_skills Re-Sync Dry Run (Zero Writes Executed) ===")
    print(f"Catalog canonical skills    : {report['catalogCanonicals']}")
    print(f"Existing skills in DB       : {report['existingSkillsInDb']}")
    print(f"Missing skills to create    : {report['missingSkillsToCreate']}")
    if args.phase in ("jobs", "all"):
        print(f"Target discovery source     : {args.source}")
        print(f"Selected job slice          : {report['selectedJobs']} (offset={args.offset}, limit={args.limit})")
        print(f"Jobs needing update         : {report['jobsNeedingUpdate']}")
        print(f"Jobs skipped (unchanged)    : {report['jobsSkippedUnchanged']}")
        print(
            f"Matched skills / job        : min={report['minMatchedSkills']}, "
            f"avg={report['avgMatchedSkills']}, max={report['maxMatchedSkills']}"
        )
        print(f"Jobs exceeding 100-cap      : {report['jobsExceeding100Cap']}")
    return report


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.bulk_job_ingest.sync_skills",
        description="Safe, resumable API-based Canonical Skill Catalog & job_skills Re-Sync CLI.",
    )
    parser.add_argument(
        "--phase",
        choices=("skills", "jobs", "all"),
        default="all",
        help="Execution phase: skills, jobs, or all (default: all)",
    )
    parser.add_argument(
        "--source",
        choices=("api", "state-db"),
        default="api",
        help="Target ACTIVE job discovery source: live API snapshot or ingest state.sqlite (default: api)",
    )
    parser.add_argument(
        "--ingest-state-db",
        type=Path,
        default=DEFAULT_RUNS_DIR / "jobs-15k" / "state.sqlite",
        help="Path to original bulk_job_ingest state.sqlite when --source state-db is used",
    )
    parser.add_argument(
        "--skill-catalog-path",
        type=Path,
        default=DEFAULT_SKILL_CATALOG_PATH,
        help=f"Canonical skill catalog JSON (default: {DEFAULT_SKILL_CATALOG_PATH})",
    )
    parser.add_argument(
        "--skill-category",
        default=DEFAULT_SKILL_CATEGORY,
        help=f"Category assigned to newly created skills (default: {DEFAULT_SKILL_CATEGORY})",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Backend base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--admin-email",
        default=os.environ.get("BULK_JOB_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL),
        help=f"Admin account email (default: {DEFAULT_ADMIN_EMAIL})",
    )
    parser.add_argument(
        "--admin-password",
        default=os.environ.get("BULK_JOB_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD),
        help="Admin account password (default: 123456 or BULK_JOB_ADMIN_PASSWORD)",
    )
    parser.add_argument(
        "--run-name",
        default=DEFAULT_RESYNC_RUN_NAME,
        help=f"Run workspace name under --runs-dir (default: {DEFAULT_RESYNC_RUN_NAME})",
    )
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=DEFAULT_RUNS_DIR,
        help=f"Base folder for state/logs/reports (default: {DEFAULT_RUNS_DIR})",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Slice offset into job_sync manifest (default: 0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum jobs to process in this run slice (default: all)",
    )
    parser.add_argument(
        "--skill-concurrency",
        type=int,
        default=DEFAULT_SKILL_CONCURRENCY,
        help=f"Concurrency for POST /api/skills seeding (default: {DEFAULT_SKILL_CONCURRENCY})",
    )
    parser.add_argument(
        "--job-concurrency",
        type=int,
        default=DEFAULT_JOB_SYNC_CONCURRENCY,
        help=f"Concurrency for job_skills resync workers (default: {DEFAULT_JOB_SYNC_CONCURRENCY})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"HTTP timeout in seconds (default: {DEFAULT_TIMEOUT_SECONDS})",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=DEFAULT_MAX_RETRIES,
        help=f"Max transient retries (default: {DEFAULT_MAX_RETRIES})",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    _configure_utf8_console()
    args = parse_args(argv)

    catalog_bytes = Path(args.skill_catalog_path).read_bytes()
    catalog_sha256 = hashlib.sha256(catalog_bytes).hexdigest()
    matcher = CanonicalSkillMatcher.from_catalog_file(args.skill_catalog_path)
    run_dir = Path(args.runs_dir) / args.run_name
    db_path = run_dir / "state.sqlite"

    max_conc = max(1, args.skill_concurrency, args.job_concurrency)
    with BackendJobIngestClient(
        args.base_url,
        admin_email=args.admin_email,
        admin_password=args.admin_password,
        max_concurrency=max_conc,
        timeout_seconds=args.timeout,
        max_retries=args.max_retries,
    ) as client:
        client.check_health()

        if args.dry_run:
            _run_dry_run(args=args, matcher=matcher, client=client)
            return 0

        started = time.perf_counter()
        logger = _build_logger(run_dir, write_file_log=True)
        admin_token = client.get_admin_token()

        existing_before = fetch_catalog_skill_map(client, admin_token=admin_token)
        skill_id_map = sync_catalog_skills(
            client,
            admin_token=admin_token,
            matcher=matcher,
            category=args.skill_category,
            concurrency=args.skill_concurrency,
        )
        skill_stats = {
            "catalogCanonicals": len(matcher.canonical_names),
            "existingBeforeSync": len(existing_before),
            "syncedSkillMapSize": len(skill_id_map),
            "createdCount": len(
                set(skill_id_map) - set(existing_before)
            ),
        }
        logger.info(
            "skills_sync_complete canonicals=%d before=%d after=%d created=%d",
            skill_stats["catalogCanonicals"],
            skill_stats["existingBeforeSync"],
            skill_stats["syncedSkillMapSize"],
            skill_stats["createdCount"],
        )

        if args.phase == "skills":
            return 0

        with SkillResyncStateStore(db_path) as store:
            manifest_state = store.initialize_or_resume_jobs(
                lambda: (
                    _load_job_ids_from_ingest_sqlite(args.ingest_state_db)
                    if args.source == "state-db"
                    else _load_job_ids_from_api(client, status="ACTIVE")
                ),
                source_mode=args.source,
                catalog_sha256=catalog_sha256,
                skill_category=args.skill_category,
            )
            selected_jobs = store.select_jobs(
                retry_failed_only=args.retry_failed,
                offset=args.offset,
                limit=args.limit,
            )
            logger.info(
                "run=%s manifest=%s source=%s selected_jobs=%d concurrency=%d retry_failed=%s",
                args.run_name,
                manifest_state,
                args.source,
                len(selected_jobs),
                args.job_concurrency,
                args.retry_failed,
            )

            outcome = run_job_resync_phase(
                jobs=selected_jobs,
                client=client,
                store=store,
                matcher=matcher,
                skill_id_map=skill_id_map,
                concurrency=args.job_concurrency,
                logger=logger,
            )
            elapsed = time.perf_counter() - started
            summary_path, failures_path = store.export_reports(
                run_dir,
                elapsed_seconds=elapsed,
                skill_counts=skill_stats,
            )
            logger.info(
                "finished elapsed=%.2fs processed=%d active=%d unchanged=%d non_active=%d "
                "retryable=%d permanent=%d summary=%s failures=%s",
                elapsed,
                outcome.processed,
                outcome.updated_active,
                outcome.skipped_unchanged,
                outcome.skipped_non_active,
                outcome.failed_retryable,
                outcome.failed_permanent,
                summary_path,
                failures_path,
            )

        return 0 if (outcome.failed_retryable == 0 and outcome.failed_permanent == 0) else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
