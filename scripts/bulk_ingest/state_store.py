"""SQLite WAL state store for crash-safe resumable manifest tracking & reporting."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import threading
from typing import Iterable, Sequence

from .scanner import ScannedPdf

STATUS_PENDING = "PENDING"
STATUS_REGISTERED = "REGISTERED"
STATUS_CV_UPLOADED = "CV_UPLOADED"
STATUS_FAILED_RETRYABLE = "FAILED_RETRYABLE"
STATUS_FAILED_PERMANENT = "FAILED_PERMANENT"

_TERMINAL_OR_DONE_STATUSES = (STATUS_CV_UPLOADED, STATUS_FAILED_PERMANENT)


class ManifestMismatchError(ValueError):
    """Raised when an existing run state conflicts with the current directory scan."""


@dataclass(frozen=True, slots=True)
class ManifestItem:
    """One persisted item row loaded from state.sqlite."""

    idx: int
    email: str
    full_name: str
    rel_path: str
    abs_path: str
    sanitized_name: str
    file_size: int
    sha256: str
    status: str
    user_id: int | None
    cv_id: int | None
    attempts: int
    last_http_status: int | None
    last_error_code: str | None
    last_error_msg: str | None
    updated_at: str


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class IngestStateStore:
    """Thread-safe ACID SQLite WAL store for student-account & CV upload ingestion."""

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

    def __enter__(self) -> IngestStateStore:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _ensure_schema(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS manifest_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS items (
                    idx INTEGER PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    rel_path TEXT UNIQUE NOT NULL,
                    abs_path TEXT NOT NULL,
                    sanitized_name TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    sha256 TEXT NOT NULL,
                    status TEXT NOT NULL,
                    user_id INTEGER,
                    cv_id INTEGER,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_http_status INTEGER,
                    last_error_code TEXT,
                    last_error_msg TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
                """
            )
            self._conn.commit()

    def initialize_or_verify_manifest(
        self,
        scanned: Sequence[ScannedPdf],
        *,
        read_only_verify: bool = False,
    ) -> str:
        """Lock manifest on first scan or verify existing idx->rel_path->sha256 integrity.

        Returns "initialized", "verified", or "dry_run_new".
        """
        with self._lock:
            existing_rows = self._conn.execute(
                "SELECT idx, email, rel_path, sha256, status FROM items ORDER BY idx ASC"
            ).fetchall()

            if not existing_rows:
                if read_only_verify:
                    return "dry_run_new"
                now = _utc_now_iso()
                with self._conn:
                    self._conn.execute(
                        "INSERT OR REPLACE INTO manifest_meta(key, value) VALUES ('created_at', ?)",
                        (now,),
                    )
                    self._conn.executemany(
                        """
                        INSERT INTO items (
                            idx, email, full_name, rel_path, abs_path, sanitized_name,
                            file_size, sha256, status, user_id, cv_id, attempts,
                            last_http_status, last_error_code, last_error_msg, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, ?, ?, ?)
                        """,
                        [
                            (
                                item.idx,
                                item.email,
                                item.full_name,
                                item.rel_path,
                                item.abs_path,
                                item.sanitized_name,
                                item.file_size,
                                item.sha256,
                                STATUS_PENDING
                                if item.is_valid
                                else STATUS_FAILED_PERMANENT,
                                None if item.is_valid else "PRECHECK_INVALID_PDF",
                                item.validation_error,
                                now,
                            )
                            for item in scanned
                        ],
                    )
                return "initialized"

            if len(existing_rows) != len(scanned):
                raise ManifestMismatchError(
                    f"Manifest count mismatch in {self.db_path}: "
                    f"locked={len(existing_rows)} vs scanned={len(scanned)}. "
                    "Use a new --run-name if the input dataset changed."
                )

            for row, item in zip(existing_rows, scanned, strict=True):
                if (
                    row["idx"] != item.idx
                    or row["email"] != item.email
                    or row["rel_path"] != item.rel_path
                ):
                    raise ManifestMismatchError(
                        f"Manifest mapping shifted at idx={row['idx']}: "
                        f"locked=({row['email']}, {row['rel_path']!r}) vs "
                        f"scanned=({item.email}, {item.rel_path!r}). "
                        "Refusing to pair existing accounts with shifted files."
                    )
                # Verify sha256 only when valid sha256 was recorded on both sides.
                if row["sha256"] and item.sha256 and row["sha256"] != item.sha256:
                    raise ManifestMismatchError(
                        f"File content changed at idx={row['idx']} ({item.rel_path}): "
                        "sha256 mismatch against locked manifest."
                    )

            return "verified"

    def select_items(
        self,
        *,
        retry_failed_only: bool = False,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[ManifestItem]:
        """Select actionable manifest rows in deterministic idx order."""
        if offset < 0:
            raise ValueError("offset must be >= 0")
        if limit is not None and limit <= 0:
            raise ValueError("limit must be > 0")

        target_statuses = (
            (STATUS_FAILED_RETRYABLE,)
            if retry_failed_only
            else (STATUS_PENDING, STATUS_REGISTERED, STATUS_FAILED_RETRYABLE)
        )
        # Apply offset/limit over ALL manifest items by idx slice first so --offset 0 --limit 10
        # stays deterministic across pilot & resume runs.
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT * FROM items
                ORDER BY idx ASC
                """
            ).fetchall()

        sliced = rows[offset:] if limit is None else rows[offset : offset + limit]
        allowed = set(target_statuses)
        return [
            self._row_to_item(row)
            for row in sliced
            if row["status"] in allowed
        ]

    def mark_registered(self, idx: int, *, user_id: int | None) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE items
                    SET status = ?,
                        user_id = COALESCE(?, user_id),
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE idx = ?
                    """,
                    (STATUS_REGISTERED, user_id, now, idx),
                )

    def mark_cv_uploaded(
        self,
        idx: int,
        *,
        user_id: int | None,
        cv_id: int,
        attempts: int,
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE items
                    SET status = ?,
                        user_id = COALESCE(?, user_id),
                        cv_id = ?,
                        attempts = ?,
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE idx = ?
                    """,
                    (STATUS_CV_UPLOADED, user_id, cv_id, attempts, now, idx),
                )

    def mark_failed(
        self,
        idx: int,
        *,
        retryable: bool,
        attempts: int,
        http_status: int | None,
        error_code: str,
        error_msg: str,
        user_id: int | None = None,
    ) -> None:
        now = _utc_now_iso()
        target_status = (
            STATUS_FAILED_RETRYABLE if retryable else STATUS_FAILED_PERMANENT
        )
        truncated_msg = error_msg[:1000]
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE items
                    SET status = ?,
                        user_id = COALESCE(?, user_id),
                        attempts = ?,
                        last_http_status = ?,
                        last_error_code = ?,
                        last_error_msg = ?,
                        updated_at = ?
                    WHERE idx = ?
                    """,
                    (
                        target_status,
                        user_id,
                        attempts,
                        http_status,
                        error_code,
                        truncated_msg,
                        now,
                        idx,
                    ),
                )

    def count_by_status(self) -> dict[str, int]:
        counts = {
            STATUS_PENDING: 0,
            STATUS_REGISTERED: 0,
            STATUS_CV_UPLOADED: 0,
            STATUS_FAILED_RETRYABLE: 0,
            STATUS_FAILED_PERMANENT: 0,
        }
        with self._lock:
            rows = self._conn.execute(
                "SELECT status, COUNT(*) AS cnt FROM items GROUP BY status"
            ).fetchall()
        for row in rows:
            counts[row["status"]] = int(row["cnt"])
        return counts

    def export_reports(
        self,
        run_dir: Path,
        *,
        elapsed_seconds: float,
        processed_in_invocation: int,
    ) -> tuple[Path, Path, dict[str, object]]:
        """Write summary.json and failures.csv atomically."""
        run_dir = Path(run_dir)
        run_dir.mkdir(parents=True, exist_ok=True)
        counts = self.count_by_status()
        total = sum(counts.values())

        summary_payload: dict[str, object] = {
            "generatedAt": _utc_now_iso(),
            "elapsedSeconds": round(elapsed_seconds, 3),
            "processedInInvocation": processed_in_invocation,
            "throughputItemsPerSec": round(
                processed_in_invocation / elapsed_seconds, 3
            )
            if elapsed_seconds > 0
            else 0.0,
            "totalManifestItems": total,
            "statusCounts": counts,
            "cvAnalysisStateNote": "All uploaded CVs intentionally remain analysis_status=NOT_READY in this phase.",
        }

        summary_path = run_dir / "summary.json"
        summary_tmp = run_dir / "summary.json.tmp"
        summary_tmp.write_text(
            json.dumps(summary_payload, indent=2) + "\n",
            encoding="utf-8",
        )
        summary_tmp.replace(summary_path)

        failures_path = run_dir / "failures.csv"
        failures_tmp = run_dir / "failures.csv.tmp"
        with self._lock:
            failed_rows = self._conn.execute(
                """
                SELECT idx, email, rel_path, status, attempts,
                       last_http_status, last_error_code, last_error_msg, updated_at
                FROM items
                WHERE status IN (?, ?)
                ORDER BY idx ASC
                """,
                (STATUS_FAILED_RETRYABLE, STATUS_FAILED_PERMANENT),
            ).fetchall()

        with failures_tmp.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "idx",
                    "email",
                    "rel_path",
                    "status",
                    "attempts",
                    "http_status",
                    "error_code",
                    "message",
                    "updated_at",
                ]
            )
            for row in failed_rows:
                writer.writerow(
                    [
                        row["idx"],
                        row["email"],
                        row["rel_path"],
                        row["status"],
                        row["attempts"],
                        "" if row["last_http_status"] is None else row["last_http_status"],
                        row["last_error_code"] or "",
                        row["last_error_msg"] or "",
                        row["updated_at"],
                    ]
                )
        failures_tmp.replace(failures_path)
        return summary_path, failures_path, summary_payload

    @staticmethod
    def _row_to_item(row: sqlite3.Row) -> ManifestItem:
        return ManifestItem(
            idx=int(row["idx"]),
            email=str(row["email"]),
            full_name=str(row["full_name"]),
            rel_path=str(row["rel_path"]),
            abs_path=str(row["abs_path"]),
            sanitized_name=str(row["sanitized_name"]),
            file_size=int(row["file_size"]),
            sha256=str(row["sha256"]),
            status=str(row["status"]),
            user_id=None if row["user_id"] is None else int(row["user_id"]),
            cv_id=None if row["cv_id"] is None else int(row["cv_id"]),
            attempts=int(row["attempts"]),
            last_http_status=(
                None
                if row["last_http_status"] is None
                else int(row["last_http_status"])
            ),
            last_error_code=(
                None if row["last_error_code"] is None else str(row["last_error_code"])
            ),
            last_error_msg=(
                None if row["last_error_msg"] is None else str(row["last_error_msg"])
            ),
            updated_at=str(row["updated_at"]),
        )
