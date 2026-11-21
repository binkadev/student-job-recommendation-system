"""SQLite WAL state store for dual-phase Company & Job ingestion."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import threading

from .csv_loader import CsvDataset, CsvLoadStats
from .skill_matcher import CanonicalSkillMatcher

COMPANY_PENDING = "PENDING"
COMPANY_REGISTERED = "REGISTERED"
COMPANY_IDENTIFIED = "IDENTIFIED"
COMPANY_VERIFIED = "VERIFIED"
COMPANY_FAILED_RETRYABLE = "FAILED_RETRYABLE"
COMPANY_FAILED_PERMANENT = "FAILED_PERMANENT"

JOB_PENDING = "PENDING"
JOB_CREATED_PENDING = "CREATED_PENDING"
JOB_CREATED_DRAFT = "CREATED_DRAFT"
JOB_ACTIVE = "ACTIVE"
JOB_FAILED_RETRYABLE = "FAILED_RETRYABLE"
JOB_FAILED_PERMANENT = "FAILED_PERMANENT"


class ManifestMismatchError(ValueError):
    """Raised when an existing state.sqlite conflicts with the current CSV."""


@dataclass(frozen=True, slots=True)
class CompanyItem:
    company_idx: int
    group_key: str
    company_name: str
    email: str
    full_name: str
    status: str
    user_id: int | None
    company_id: int | None
    attempts: int


@dataclass(frozen=True, slots=True)
class JobItem:
    job_row_idx: int
    csv_line_number: int
    company_idx: int
    company_id: int | None
    group_key: str
    title: str
    description: str
    requirements: str | None
    skills_canonical: tuple[str, ...]
    target_status: str
    status: str
    job_id: int | None
    attempts: int


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class JobIngestStateStore:
    """Thread-safe ACID SQLite WAL store for grouped Companies and Jobs."""

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

    def __enter__(self) -> JobIngestStateStore:
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

                CREATE TABLE IF NOT EXISTS companies (
                    company_idx INTEGER PRIMARY KEY,
                    group_key TEXT UNIQUE NOT NULL,
                    company_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    user_id INTEGER,
                    company_id INTEGER,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_http_status INTEGER,
                    last_error_code TEXT,
                    last_error_msg TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS jobs (
                    job_row_idx INTEGER PRIMARY KEY,
                    csv_line_number INTEGER NOT NULL,
                    company_idx INTEGER NOT NULL REFERENCES companies(company_idx),
                    row_sha256 TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    requirements TEXT,
                    extracted_skills_json TEXT NOT NULL,
                    target_status TEXT NOT NULL,
                    status TEXT NOT NULL,
                    job_id INTEGER,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_http_status INTEGER,
                    last_error_code TEXT,
                    last_error_msg TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
                CREATE INDEX IF NOT EXISTS idx_jobs_company_idx ON jobs(company_idx);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_job_id
                    ON jobs(job_id) WHERE job_id IS NOT NULL;
                """
            )
            self._conn.commit()

    def initialize_or_verify_manifest(
        self,
        dataset: CsvDataset,
        *,
        matcher: CanonicalSkillMatcher,
        default_target_status: str,
        activate_limit: int | None = None,
        read_only_verify: bool = False,
    ) -> str:
        """Lock companies & jobs manifest on first scan or verify existing integrity."""
        with self._lock:
            existing_companies = self._conn.execute(
                "SELECT company_idx, group_key, email FROM companies ORDER BY company_idx ASC"
            ).fetchall()
            existing_jobs = self._conn.execute(
                "SELECT job_row_idx, company_idx, row_sha256 FROM jobs ORDER BY job_row_idx ASC"
            ).fetchall()

            if not existing_companies and not existing_jobs:
                if read_only_verify:
                    return "dry_run_new"
                now = _utc_now_iso()
                with self._conn:
                    self._save_stats_meta_unlocked(dataset.stats, now=now)
                    self._conn.executemany(
                        """
                        INSERT INTO companies (
                            company_idx, group_key, company_name, email, full_name,
                            status, user_id, company_id, attempts,
                            last_http_status, last_error_code, last_error_msg, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, NULL, ?)
                        """,
                        [
                            (
                                c.company_idx,
                                c.group_key,
                                c.company_name,
                                c.email,
                                c.full_name,
                                COMPANY_PENDING,
                                now,
                            )
                            for c in dataset.companies
                        ],
                    )
                    job_rows = []
                    for j in dataset.jobs:
                        if default_target_status == "ACTIVE" and (
                            activate_limit is None or j.job_row_idx < activate_limit
                        ):
                            row_target = "ACTIVE"
                        else:
                            row_target = "DRAFT"
                        combined = "\n".join(
                            part
                            for part in (j.title, j.description, j.requirements or "")
                            if part
                        )
                        skills = matcher.extract_canonical_skills(combined)
                        job_rows.append(
                            (
                                j.job_row_idx,
                                j.csv_line_number,
                                j.company_idx,
                                j.row_sha256,
                                j.title,
                                j.description,
                                j.requirements,
                                json.dumps(list(skills)),
                                row_target,
                                JOB_PENDING,
                                now,
                            )
                        )
                    self._conn.executemany(
                        """
                        INSERT INTO jobs (
                            job_row_idx, csv_line_number, company_idx, row_sha256,
                            title, description, requirements, extracted_skills_json,
                            target_status, status, job_id, attempts,
                            last_http_status, last_error_code, last_error_msg, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, NULL, ?)
                        """,
                        job_rows,
                    )
                return "initialized"

            if len(existing_companies) != len(dataset.companies):
                raise ManifestMismatchError(
                    f"Company count mismatch: locked={len(existing_companies)} vs csv={len(dataset.companies)}"
                )
            if len(existing_jobs) != len(dataset.jobs):
                raise ManifestMismatchError(
                    f"Job count mismatch: locked={len(existing_jobs)} vs csv={len(dataset.jobs)}"
                )

            for row, c in zip(existing_companies, dataset.companies, strict=True):
                if (
                    row["company_idx"] != c.company_idx
                    or row["group_key"] != c.group_key
                    or row["email"] != c.email
                ):
                    raise ManifestMismatchError(
                        f"Company mapping shifted at idx={row['company_idx']}: "
                        f"locked=({row['email']}, {row['group_key']!r}) vs "
                        f"csv=({c.email}, {c.group_key!r}). Use a new --run-name."
                    )

            for row, j in zip(existing_jobs, dataset.jobs, strict=True):
                if (
                    row["job_row_idx"] != j.job_row_idx
                    or row["company_idx"] != j.company_idx
                    or row["row_sha256"] != j.row_sha256
                ):
                    raise ManifestMismatchError(
                        f"Job manifest changed at row_idx={row['job_row_idx']}; "
                        "refusing to mix modified rows into existing run."
                    )

            return "verified"

    def _save_stats_meta_unlocked(self, stats: CsvLoadStats, *, now: str) -> None:
        meta_items = {
            "created_at": now,
            "total_csv_rows": str(stats.total_csv_rows),
            "valid_job_rows": str(stats.valid_job_rows),
            "unique_companies": str(stats.unique_companies),
            "blank_name_skipped": str(stats.blank_name_skipped),
            "blank_description_skipped": str(stats.blank_description_skipped),
            "truncated_name_count": str(stats.truncated_name_count),
            "truncated_description_count": str(stats.truncated_description_count),
            "truncated_requirements_count": str(stats.truncated_requirements_count),
            "encoding_used": stats.encoding_used,
        }
        self._conn.executemany(
            "INSERT OR REPLACE INTO manifest_meta(key, value) VALUES (?, ?)",
            list(meta_items.items()),
        )

    def select_companies(
        self,
        *,
        retry_failed_only: bool = False,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[CompanyItem]:
        allowed = (
            {COMPANY_FAILED_RETRYABLE}
            if retry_failed_only
            else {
                COMPANY_PENDING,
                COMPANY_REGISTERED,
                COMPANY_IDENTIFIED,
                COMPANY_FAILED_RETRYABLE,
            }
        )
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM companies ORDER BY company_idx ASC"
            ).fetchall()
        sliced = rows[offset:] if limit is None else rows[offset : offset + limit]
        return [self._row_to_company(r) for r in sliced if r["status"] in allowed]

    def select_jobs(
        self,
        *,
        retry_failed_only: bool = False,
        offset: int = 0,
        limit: int | None = None,
    ) -> list[JobItem]:
        allowed = (
            {JOB_FAILED_RETRYABLE}
            if retry_failed_only
            else {JOB_PENDING, JOB_CREATED_PENDING, JOB_FAILED_RETRYABLE}
        )
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT j.*, c.company_id AS resolved_company_id, c.group_key AS company_group_key
                FROM jobs j
                JOIN companies c ON c.company_idx = j.company_idx
                ORDER BY j.job_row_idx ASC
                """
            ).fetchall()
        sliced = rows[offset:] if limit is None else rows[offset : offset + limit]
        return [self._row_to_job(r) for r in sliced if r["status"] in allowed]

    def mark_company_registered(
        self, company_idx: int, *, user_id: int | None
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE companies
                    SET status = ?,
                        user_id = COALESCE(?, user_id),
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE company_idx = ?
                    """,
                    (COMPANY_REGISTERED, user_id, now, company_idx),
                )

    def mark_company_identified(
        self, company_idx: int, *, company_id: int
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE companies
                    SET status = ?,
                        company_id = ?,
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE company_idx = ?
                    """,
                    (COMPANY_IDENTIFIED, company_id, now, company_idx),
                )

    def mark_company_verified(
        self, company_idx: int, *, company_id: int, attempts: int
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE companies
                    SET status = ?,
                        company_id = ?,
                        attempts = ?,
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE company_idx = ?
                    """,
                    (COMPANY_VERIFIED, company_id, attempts, now, company_idx),
                )

    def mark_company_failed(
        self,
        company_idx: int,
        *,
        retryable: bool,
        attempts: int,
        http_status: int | None,
        error_code: str,
        error_msg: str,
    ) -> None:
        now = _utc_now_iso()
        status = (
            COMPANY_FAILED_RETRYABLE if retryable else COMPANY_FAILED_PERMANENT
        )
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE companies
                    SET status = ?,
                        attempts = ?,
                        last_http_status = ?,
                        last_error_code = ?,
                        last_error_msg = ?,
                        updated_at = ?
                    WHERE company_idx = ?
                    """,
                    (
                        status,
                        attempts,
                        http_status,
                        error_code,
                        error_msg[:1000],
                        now,
                        company_idx,
                    ),
                )

    def get_claimed_job_ids(self) -> set[int]:
        """Return all Backend job_ids already claimed by manifest rows."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT job_id FROM jobs WHERE job_id IS NOT NULL"
            ).fetchall()
        return {int(row["job_id"]) for row in rows}

    def try_claim_existing_job(
        self,
        job_row_idx: int,
        *,
        job_id: int,
        status: str,
        attempts: int,
    ) -> bool:
        """Atomically assign an orphan recovered job_id if unclaimed by any other row."""
        now = _utc_now_iso()
        with self._lock:
            existing = self._conn.execute(
                "SELECT job_row_idx FROM jobs WHERE job_id = ?",
                (job_id,),
            ).fetchone()
            if existing is not None and int(existing["job_row_idx"]) != job_row_idx:
                return False
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE jobs
                    SET job_id = ?,
                        status = ?,
                        attempts = ?,
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE job_row_idx = ?
                    """,
                    (job_id, status, attempts, now, job_row_idx),
                )
            return True

    def mark_job_created_pending(
        self, job_row_idx: int, *, job_id: int, attempts: int
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE jobs
                    SET job_id = ?,
                        status = ?,
                        attempts = ?,
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE job_row_idx = ?
                    """,
                    (job_id, JOB_CREATED_PENDING, attempts, now, job_row_idx),
                )

    def mark_job_done(
        self, job_row_idx: int, *, job_id: int, final_status: str, attempts: int
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE jobs
                    SET job_id = ?,
                        status = ?,
                        attempts = ?,
                        last_http_status = NULL,
                        last_error_code = NULL,
                        last_error_msg = NULL,
                        updated_at = ?
                    WHERE job_row_idx = ?
                    """,
                    (job_id, final_status, attempts, now, job_row_idx),
                )

    def mark_job_failed(
        self,
        job_row_idx: int,
        *,
        retryable: bool,
        attempts: int,
        http_status: int | None,
        error_code: str,
        error_msg: str,
    ) -> None:
        now = _utc_now_iso()
        status = JOB_FAILED_RETRYABLE if retryable else JOB_FAILED_PERMANENT
        with self._lock:
            with self._conn:
                self._conn.execute(
                    """
                    UPDATE jobs
                    SET status = ?,
                        attempts = ?,
                        last_http_status = ?,
                        last_error_code = ?,
                        last_error_msg = ?,
                        updated_at = ?
                    WHERE job_row_idx = ?
                    """,
                    (
                        status,
                        attempts,
                        http_status,
                        error_code,
                        error_msg[:1000],
                        now,
                        job_row_idx,
                    ),
                )

    def count_companies_by_status(self) -> dict[str, int]:
        counts = {
            COMPANY_PENDING: 0,
            COMPANY_REGISTERED: 0,
            COMPANY_IDENTIFIED: 0,
            COMPANY_VERIFIED: 0,
            COMPANY_FAILED_RETRYABLE: 0,
            COMPANY_FAILED_PERMANENT: 0,
        }
        with self._lock:
            for row in self._conn.execute(
                "SELECT status, COUNT(*) AS cnt FROM companies GROUP BY status"
            ).fetchall():
                counts[row["status"]] = int(row["cnt"])
        return counts

    def count_jobs_by_status(self) -> dict[str, int]:
        counts = {
            JOB_PENDING: 0,
            JOB_CREATED_PENDING: 0,
            JOB_CREATED_DRAFT: 0,
            JOB_ACTIVE: 0,
            JOB_FAILED_RETRYABLE: 0,
            JOB_FAILED_PERMANENT: 0,
        }
        with self._lock:
            for row in self._conn.execute(
                "SELECT status, COUNT(*) AS cnt FROM jobs GROUP BY status"
            ).fetchall():
                counts[row["status"]] = int(row["cnt"])
        return counts

    def export_reports(
        self, run_dir: Path, *, elapsed_seconds: float
    ) -> tuple[Path, Path, dict[str, object]]:
        run_dir = Path(run_dir)
        run_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            meta_rows = {
                row["key"]: row["value"]
                for row in self._conn.execute(
                    "SELECT key, value FROM manifest_meta"
                ).fetchall()
            }
            company_failures = self._conn.execute(
                """
                SELECT 'COMPANY' AS entity_type, company_idx AS idx, email AS identifier,
                       company_name AS label, status, attempts, last_http_status,
                       last_error_code, last_error_msg, updated_at
                FROM companies
                WHERE status IN (?, ?)
                ORDER BY company_idx ASC
                """,
                (COMPANY_FAILED_RETRYABLE, COMPANY_FAILED_PERMANENT),
            ).fetchall()
            job_failures = self._conn.execute(
                """
                SELECT 'JOB' AS entity_type, job_row_idx AS idx,
                       CAST(csv_line_number AS TEXT) AS identifier,
                       title AS label, status, attempts, last_http_status,
                       last_error_code, last_error_msg, updated_at
                FROM jobs
                WHERE status IN (?, ?)
                ORDER BY job_row_idx ASC
                """,
                (JOB_FAILED_RETRYABLE, JOB_FAILED_PERMANENT),
            ).fetchall()

        summary_payload: dict[str, object] = {
            "generatedAt": _utc_now_iso(),
            "elapsedSeconds": round(elapsed_seconds, 3),
            "csvPreflight": {
                "totalCsvRows": int(meta_rows.get("total_csv_rows", "0")),
                "validJobRows": int(meta_rows.get("valid_job_rows", "0")),
                "uniqueCompanies": int(meta_rows.get("unique_companies", "0")),
                "blankNameSkipped": int(meta_rows.get("blank_name_skipped", "0")),
                "blankDescriptionSkipped": int(
                    meta_rows.get("blank_description_skipped", "0")
                ),
                "truncatedNameCount": int(meta_rows.get("truncated_name_count", "0")),
                "truncatedDescriptionCount": int(
                    meta_rows.get("truncated_description_count", "0")
                ),
                "truncatedRequirementsCount": int(
                    meta_rows.get("truncated_requirements_count", "0")
                ),
                "encodingUsed": meta_rows.get("encoding_used", ""),
            },
            "companyStatusCounts": self.count_companies_by_status(),
            "jobStatusCounts": self.count_jobs_by_status(),
        }

        summary_path = run_dir / "summary.json"
        summary_tmp = run_dir / "summary.json.tmp"
        summary_tmp.write_text(
            json.dumps(summary_payload, indent=2) + "\n", encoding="utf-8"
        )
        summary_tmp.replace(summary_path)

        failures_path = run_dir / "failures.csv"
        failures_tmp = run_dir / "failures.csv.tmp"
        with failures_tmp.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "entity_type",
                    "idx",
                    "identifier",
                    "label",
                    "status",
                    "attempts",
                    "http_status",
                    "error_code",
                    "message",
                    "updated_at",
                ]
            )
            for row in [*company_failures, *job_failures]:
                writer.writerow(
                    [
                        row["entity_type"],
                        row["idx"],
                        row["identifier"],
                        row["label"],
                        row["status"],
                        row["attempts"],
                        ""
                        if row["last_http_status"] is None
                        else row["last_http_status"],
                        row["last_error_code"] or "",
                        row["last_error_msg"] or "",
                        row["updated_at"],
                    ]
                )
        failures_tmp.replace(failures_path)
        return summary_path, failures_path, summary_payload

    @staticmethod
    def _row_to_company(row: sqlite3.Row) -> CompanyItem:
        return CompanyItem(
            company_idx=int(row["company_idx"]),
            group_key=str(row["group_key"]),
            company_name=str(row["company_name"]),
            email=str(row["email"]),
            full_name=str(row["full_name"]),
            status=str(row["status"]),
            user_id=None if row["user_id"] is None else int(row["user_id"]),
            company_id=None
            if row["company_id"] is None
            else int(row["company_id"]),
            attempts=int(row["attempts"]),
        )

    @staticmethod
    def _row_to_job(row: sqlite3.Row) -> JobItem:
        raw_skills = json.loads(row["extracted_skills_json"])
        return JobItem(
            job_row_idx=int(row["job_row_idx"]),
            csv_line_number=int(row["csv_line_number"]),
            company_idx=int(row["company_idx"]),
            company_id=None
            if row["resolved_company_id"] is None
            else int(row["resolved_company_id"]),
            group_key=str(row["company_group_key"]),
            title=str(row["title"]),
            description=str(row["description"]),
            requirements=row["requirements"],
            skills_canonical=tuple(str(s) for s in raw_skills),
            target_status=str(row["target_status"]),
            status=str(row["status"]),
            job_id=None if row["job_id"] is None else int(row["job_id"]),
            attempts=int(row["attempts"]),
        )
