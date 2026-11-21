"""Unit tests for bulk CV /reanalyze CLI, error classification, and resume logic."""

from __future__ import annotations

import csv
import hashlib
import json
import logging
from pathlib import Path
import sqlite3

import httpx

from scripts.bulk_ingest.analyze import (
    ANALYZE_FAILED_PERMANENT,
    ANALYZE_FAILED_RETRYABLE,
    ANALYZE_PENDING,
    ANALYZE_READY,
    ANALYZE_SKIPPED_ALREADY_READY,
    DEFAULT_TARGET_PROCESSING_VERSION,
    AnalyzeStateStore,
    main as analyze_main,
    run_cv_analysis,
)
from scripts.bulk_ingest.client import BackendIngestClient


def _ok(data: object, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json={"success": True, "message": "ok", "errorCode": None, "data": data},
    )


def _err(status: int, code: str, message: str) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json={"success": False, "message": message, "errorCode": code, "data": None},
    )


def _create_mock_ingest_db(path: Path, rows: list[tuple[int, str, int, int]]) -> str:
    """Create a realistic ingest state.sqlite with items table and return its SHA-256."""
    conn = sqlite3.connect(str(path))
    conn.executescript(
        """
        CREATE TABLE items (
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
        """
    )
    conn.executemany(
        """
        INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, 1024, 'abc', 'CV_UPLOADED', ?, ?, 1, NULL, NULL, NULL, '2026-11-20T00:00:00+00:00')
        """,
        [
            (idx, email, f"n22dccn{idx:04d}", f"{idx}.pdf", f"C:/tmp/{idx}.pdf", f"{idx}.pdf", uid, cv_id)
            for idx, email, uid, cv_id in rows
        ],
    )
    conn.commit()
    conn.close()
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_analyze_workflows_skip_reanalyze_permanent_502_and_transient_retry_resume(
    tmp_path: Path,
) -> None:
    ingest_db = tmp_path / "ingest_state.sqlite"
    rows = [
        (0, "n22dccn0000@gmail.com", 10, 100),  # Already READY with current version -> skip
        (1, "n22dccn0001@gmail.com", 11, 101),  # NOT_READY -> /reanalyze -> READY
        (2, "n22dccn0002@gmail.com", 12, 102),  # /reanalyze -> 502 AI_SERVICE_INVALID_RESPONSE (0 retries, permanent!)
        (3, "n22dccn0003@gmail.com", 13, 103),  # 503 then 504 then recovers on 3rd try -> READY
        (4, "n22dccn0004@gmail.com", 14, 104),  # Always 504 -> exhausts retries -> FAILED_RETRYABLE -> succeeds on --retry-failed
    ]
    ingest_sha_before = _create_mock_ingest_db(ingest_db, rows)

    reanalyze_calls: dict[int, int] = {100: 0, 101: 0, 102: 0, 103: 0, 104: 0}
    fail_cv_104_forever = True

    live_analysis: dict[int, dict[str, object]] = {
        100: {
            "cvId": 100,
            "status": "READY",
            "processingVersion": DEFAULT_TARGET_PROCESSING_VERSION,
            "languageCode": "en",
            "languageConfidence": 0.99,
            "skills": ["java", "spring boot"],
            "analysisError": None,
        },
        101: {"cvId": 101, "status": "NOT_READY", "processingVersion": None, "skills": []},
        102: {"cvId": 102, "status": "NOT_READY", "processingVersion": None, "skills": []},
        103: {"cvId": 103, "status": "NOT_READY", "processingVersion": None, "skills": []},
        104: {"cvId": 104, "status": "NOT_READY", "processingVersion": None, "skills": []},
    }

    sleep_delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/public/statistics":
            return _ok({"totalJobs": 0})
        if path == "/api/auth/login":
            return _ok({"token": "student-jwt", "user": {"id": 10}})
        assert request.headers.get("Authorization") == "Bearer student-jwt"

        if path.startswith("/api/students/me/cv/") and path.endswith("/analysis") and request.method == "GET":
            cv_id = int(path.split("/")[5])
            return _ok(live_analysis[cv_id])

        if path.startswith("/api/students/me/cv/") and path.endswith("/reanalyze") and request.method == "POST":
            cv_id = int(path.split("/")[5])
            reanalyze_calls[cv_id] += 1
            call_num = reanalyze_calls[cv_id]

            if cv_id == 101:
                res = {
                    "cvId": 101,
                    "status": "READY",
                    "processingVersion": DEFAULT_TARGET_PROCESSING_VERSION,
                    "languageCode": "en",
                    "languageConfidence": 0.95,
                    "skills": ["python", "docker", "postgresql"],
                    "analysisError": None,
                }
                live_analysis[101] = res
                return _ok(res)

            if cv_id == 102:
                # Backend persists FAILED + analysisError and returns 502 AI_SERVICE_INVALID_RESPONSE
                live_analysis[102] = {
                    "cvId": 102,
                    "status": "FAILED",
                    "processingVersion": None,
                    "skills": [],
                    "analysisError": "Unsupported CV language: only English resumes >= 0.65 confidence accepted",
                }
                return _err(502, "AI_SERVICE_INVALID_RESPONSE", "AI service returned an invalid response")

            if cv_id == 103:
                if call_num == 1:
                    return _err(503, "AI_SERVICE_UNAVAILABLE", "AI service unavailable")
                if call_num == 2:
                    return _err(504, "AI_SERVICE_TIMEOUT", "AI service timed out")
                res = {
                    "cvId": 103,
                    "status": "READY",
                    "processingVersion": DEFAULT_TARGET_PROCESSING_VERSION,
                    "languageCode": "en",
                    "languageConfidence": 0.91,
                    "skills": ["react", "typescript"],
                    "analysisError": None,
                }
                live_analysis[103] = res
                return _ok(res)

            if cv_id == 104:
                if fail_cv_104_forever:
                    return _err(504, "AI_SERVICE_TIMEOUT", "AI service request timed out")
                res = {
                    "cvId": 104,
                    "status": "READY",
                    "processingVersion": DEFAULT_TARGET_PROCESSING_VERSION,
                    "languageCode": "en",
                    "languageConfidence": 0.88,
                    "skills": ["go"],
                    "analysisError": None,
                }
                live_analysis[104] = res
                return _ok(res)

        raise AssertionError(f"Unhandled request: {request.method} {path}")

    run_dir = tmp_path / "runs" / "batch-5k"
    analyze_db = run_dir / "analyze_state.sqlite"
    with (
        AnalyzeStateStore(analyze_db) as store,
        BackendIngestClient(
            "http://backend.test",
            concurrency=1,
            timeout_seconds=45.0,
            max_retries=2,
            transport=httpx.MockTransport(handler),
            sleep_fn=sleep_delays.append,
        ) as client,
    ):
        manifest_state = store.initialize_or_verify_from_ingest(
            ingest_db, target_processing_version=DEFAULT_TARGET_PROCESSING_VERSION
        )
        assert manifest_state == "initialized"

        outcome = run_cv_analysis(
            items=store.select_items(),
            client=client,
            store=store,
            run_dir=run_dir,
            concurrency=1,
            logger=logging.getLogger("test_analyze_1"),
        )

    assert outcome.skipped_already_ready == 1  # cv 100
    assert outcome.ready == 2  # cv 101 + cv 103
    assert outcome.failed_permanent == 1  # cv 102
    assert outcome.failed_retryable == 1  # cv 104
    assert outcome.aborted is False

    # Critical invariants:
    assert reanalyze_calls[100] == 0  # Skipped without POST /reanalyze
    assert reanalyze_calls[102] == 1  # 502 AI_SERVICE_INVALID_RESPONSE NEVER retried!
    assert reanalyze_calls[103] == 3  # 503 -> retry -> 504 -> retry -> READY
    assert reanalyze_calls[104] == 3  # 1 initial + 2 retries before exhausting
    assert len(sleep_delays) == 4  # 2 retries for cv 103 + 2 retries for cv 104

    # Verify original ingest state.sqlite was NOT modified at all!
    assert hashlib.sha256(ingest_db.read_bytes()).hexdigest() == ingest_sha_before

    # Verify summary & failures artifacts + captured analysisError
    summary = json.loads(outcome.summary_path.read_text(encoding="utf-8"))
    assert summary["statusCounts"] == {
        ANALYZE_READY: 2,
        ANALYZE_SKIPPED_ALREADY_READY: 1,
        ANALYZE_FAILED_PERMANENT: 1,
        ANALYZE_FAILED_RETRYABLE: 1,
        ANALYZE_PENDING: 0,
    }
    assert summary["languageBreakdown"] == {"en": 3}

    with outcome.failures_path.open("r", encoding="utf-8") as handle:
        fail_rows = list(csv.DictReader(handle))
    assert len(fail_rows) == 2
    by_cv = {int(r["cv_id"]): r for r in fail_rows}
    assert by_cv[102]["status"] == ANALYZE_FAILED_PERMANENT
    assert by_cv[102]["error_code"] == "AI_SERVICE_INVALID_RESPONSE"
    assert "Unsupported CV language" in by_cv[102]["error_message"]
    assert by_cv[104]["status"] == ANALYZE_FAILED_RETRYABLE

    # Now fix cv 104 upstream and run --retry-failed -> MUST only touch cv 104!
    fail_cv_104_forever = False
    with (
        AnalyzeStateStore(analyze_db) as store,
        BackendIngestClient(
            "http://backend.test",
            concurrency=1,
            timeout_seconds=45.0,
            max_retries=1,
            transport=httpx.MockTransport(handler),
            sleep_fn=lambda _s: None,
        ) as client,
    ):
        retry_items = store.select_items(retry_failed_only=True)
        assert [i.cv_id for i in retry_items] == [104]
        retry_out = run_cv_analysis(
            items=retry_items,
            client=client,
            store=store,
            run_dir=run_dir,
            concurrency=1,
            logger=logging.getLogger("test_analyze_retry"),
        )

    assert retry_out.ready == 1
    assert retry_out.failed_retryable == 0
    assert reanalyze_calls[101] == 1  # untouched
    assert reanalyze_calls[102] == 1  # untouched
    assert reanalyze_calls[104] == 4


def test_fail_fast_aborts_after_consecutive_503_outage(
    tmp_path: Path, monkeypatch
) -> None:
    ingest_db = tmp_path / "ingest_state.sqlite"
    rows = [(i, f"n22dccn{i:04d}@gmail.com", 10 + i, 200 + i) for i in range(15)]
    _create_mock_ingest_db(ingest_db, rows)

    reanalyze_attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal reanalyze_attempts
        path = request.url.path
        if path == "/api/public/statistics":
            return _ok({"totalJobs": 0})
        if path == "/api/auth/login":
            return _ok({"token": "student-jwt", "user": {"id": 10}})
        if path.endswith("/analysis"):
            cv_id = int(path.split("/")[5])
            return _ok({"cvId": cv_id, "status": "NOT_READY", "skills": []})
        if path.endswith("/reanalyze"):
            reanalyze_attempts += 1
            return _err(503, "AI_SERVICE_UNAVAILABLE", "AI service is down")
        raise AssertionError(f"Unhandled: {request.method} {path}")

    orig_init = BackendIngestClient.__init__

    def _patched_init(self, *args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        kwargs["sleep_fn"] = lambda _s: None
        return orig_init(self, *args, **kwargs)

    monkeypatch.setattr(BackendIngestClient, "__init__", _patched_init)

    rc = analyze_main(
        [
            "--ingest-state-db", str(ingest_db),
            "--runs-dir", str(tmp_path / "runs"),
            "--run-name", "outage",
            "--concurrency", "1",
            "--max-retries", "0",
            "--fail-fast-threshold", "5",
        ]
    )
    assert rc == 3  # Aborted early!
    assert reanalyze_attempts == 5  # Stopped immediately at 5 instead of burning through all 15!

    summary = json.loads(
        (tmp_path / "runs" / "outage" / "analyze_summary.json").read_text(encoding="utf-8")
    )
    assert summary["abortedEarly"] is True
    assert summary["statusCounts"][ANALYZE_FAILED_RETRYABLE] == 5
    assert summary["statusCounts"][ANALYZE_PENDING] == 10
