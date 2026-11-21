"""Unit tests for BackendIngestClient and worker idempotency/retry behavior."""

from __future__ import annotations

import json
import logging
from pathlib import Path
import threading

import httpx

from scripts.bulk_ingest.client import BackendIngestClient
from scripts.bulk_ingest.scanner import scan_pdf_directory
from scripts.bulk_ingest.state_store import (
    STATUS_CV_UPLOADED,
    STATUS_FAILED_PERMANENT,
    STATUS_FAILED_RETRYABLE,
    IngestStateStore,
)
from scripts.bulk_ingest.worker import run_ingestion

_MINIMAL_PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


def _make_response(status_code: int, payload: dict[str, object]) -> httpx.Response:
    return httpx.Response(status_code=status_code, json=payload)


def test_happy_path_and_never_calls_reanalyze(tmp_path: Path) -> None:
    cv_dir = tmp_path / "cvs"
    cv_dir.mkdir()
    (cv_dir / "Nguyễn Văn A.pdf").write_bytes(_MINIMAL_PDF)
    (cv_dir / "Tran B.pdf").write_bytes(_MINIMAL_PDF + b"% b\n")

    seen_calls: list[tuple[str, str]] = []
    register_bodies: list[dict[str, object]] = []
    lock = threading.Lock()

    def handler(request: httpx.Request) -> httpx.Response:
        with lock:
            seen_calls.append((request.method, request.url.path))
        if request.url.path == "/api/auth/register":
            body = json.loads(request.content.decode("utf-8"))
            with lock:
                register_bodies.append(body)
            return _make_response(
                201,
                {"success": True, "message": "ok", "errorCode": None, "data": {"id": 50}},
            )
        if request.url.path == "/api/auth/login":
            return _make_response(
                200,
                {
                    "success": True,
                    "message": "ok",
                    "errorCode": None,
                    "data": {"token": "jwt-token-123", "user": {"id": 50}},
                },
            )
        if request.url.path == "/api/students/me/cv":
            assert request.url.params.get("active") == "true"
            assert request.headers.get("Authorization") == "Bearer jwt-token-123"
            return _make_response(
                200,
                {"success": True, "message": "ok", "errorCode": None, "data": {"id": 900}},
            )
        raise AssertionError(f"Unexpected path: {request.url.path}")

    scan = scan_pdf_directory([cv_dir])
    run_dir = tmp_path / "run"
    with (
        IngestStateStore(run_dir / "state.sqlite") as store,
        BackendIngestClient(
            "http://backend.test",
            concurrency=2,
            max_retries=2,
            transport=httpx.MockTransport(handler),
            sleep_fn=lambda _sec: None,
        ) as client,
    ):
        store.initialize_or_verify_manifest(scan.items)
        items = store.select_items()
        outcome = run_ingestion(
            items=items,
            client=client,
            store=store,
            run_dir=run_dir,
            concurrency=2,
            logger=logging.getLogger("test_happy"),
        )

    assert outcome.succeeded == 2
    assert outcome.failed_retryable == 0
    assert outcome.failed_permanent == 0
    assert outcome.status_counts[STATUS_CV_UPLOADED] == 2
    assert all("/reanalyze" not in path for _, path in seen_calls)
    for body in register_bodies:
        assert body["role"] == "STUDENT"
        assert body["password"] == "000000"
        assert "phone" not in body


def test_idempotent_409_recovery_skips_duplicate_upload(tmp_path: Path) -> None:
    cv_dir = tmp_path / "cvs"
    cv_dir.mkdir()
    pdf_bytes = _MINIMAL_PDF
    (cv_dir / "CV Test.pdf").write_bytes(pdf_bytes)

    upload_attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal upload_attempts
        if request.url.path == "/api/auth/register":
            return _make_response(
                409,
                {
                    "success": False,
                    "message": "Email already exists",
                    "errorCode": "EMAIL_ALREADY_EXISTS",
                    "data": None,
                },
            )
        if request.url.path == "/api/auth/login":
            return _make_response(
                200,
                {
                    "success": True,
                    "message": "ok",
                    "errorCode": None,
                    "data": {"token": "jwt-existing", "user": {"id": 77}},
                },
            )
        if request.url.path == "/api/students/me/cv" and request.method == "GET":
            return _make_response(
                200,
                {
                    "success": True,
                    "message": "ok",
                    "errorCode": None,
                    "data": [
                        {
                            "id": 321,
                            "originalFileName": "CV_Test.pdf",
                            "fileSize": len(pdf_bytes),
                            "isActive": True,
                        }
                    ],
                },
            )
        if request.url.path == "/api/students/me/cv" and request.method == "POST":
            upload_attempts += 1
            return _make_response(
                200,
                {"success": True, "message": "ok", "errorCode": None, "data": {"id": 999}},
            )
        raise AssertionError(f"Unexpected call: {request.method} {request.url.path}")

    scan = scan_pdf_directory([cv_dir])
    run_dir = tmp_path / "run"
    with (
        IngestStateStore(run_dir / "state.sqlite") as store,
        BackendIngestClient(
            "http://backend.test",
            concurrency=1,
            transport=httpx.MockTransport(handler),
            sleep_fn=lambda _sec: None,
        ) as client,
    ):
        store.initialize_or_verify_manifest(scan.items)
        outcome = run_ingestion(
            items=store.select_items(),
            client=client,
            store=store,
            run_dir=run_dir,
            concurrency=1,
            logger=logging.getLogger("test_409"),
        )
        rows = store._conn.execute("SELECT user_id, cv_id, status FROM items").fetchall()

    assert outcome.succeeded == 1
    assert upload_attempts == 0
    assert rows[0]["user_id"] == 77
    assert rows[0]["cv_id"] == 321
    assert rows[0]["status"] == STATUS_CV_UPLOADED


def test_transient_retry_exhaustion_and_permanent_failure_continue(tmp_path: Path) -> None:
    cv_dir = tmp_path / "cvs"
    cv_dir.mkdir()
    (cv_dir / "01_transient.pdf").write_bytes(_MINIMAL_PDF)
    (cv_dir / "02_bad_request.pdf").write_bytes(_MINIMAL_PDF + b"% 2\n")
    (cv_dir / "03_ok_after_retry.pdf").write_bytes(_MINIMAL_PDF + b"% 3\n")

    attempt_counts: dict[str, int] = {}
    phase_fail_transient = True

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/auth/register":
            email = json.loads(request.content.decode("utf-8"))["email"]
            attempt_counts[email] = attempt_counts.get(email, 0) + 1
            if email == "n22dccn0000@gmail.com" and phase_fail_transient:
                return _make_response(
                    503,
                    {"success": False, "message": "busy", "errorCode": "AI_SERVICE_UNAVAILABLE", "data": None},
                )
            if email == "n22dccn0002@gmail.com" and attempt_counts[email] == 1:
                return _make_response(
                    503,
                    {"success": False, "message": "flaky", "errorCode": "HTTP_503", "data": None},
                )
            return _make_response(
                201,
                {"success": True, "message": "ok", "errorCode": None, "data": {"id": 10}},
            )
        if request.url.path == "/api/auth/login":
            email = json.loads(request.content.decode("utf-8"))["email"]
            return _make_response(
                200,
                {
                    "success": True,
                    "message": "ok",
                    "errorCode": None,
                    "data": {"token": f"tok-{email}", "user": {"id": 10}},
                },
            )
        if request.url.path == "/api/students/me/cv" and request.method == "POST":
            auth = request.headers.get("Authorization", "")
            if auth == "Bearer tok-n22dccn0001@gmail.com":
                return _make_response(
                    400,
                    {"success": False, "message": "bad file", "errorCode": "BAD_REQUEST", "data": None},
                )
            return _make_response(
                200,
                {"success": True, "message": "ok", "errorCode": None, "data": {"id": 555}},
            )
        if request.url.path == "/api/students/me/cv" and request.method == "GET":
            return _make_response(200, {"success": True, "message": "ok", "errorCode": None, "data": []})
        raise AssertionError(f"Unexpected: {request.method} {request.url.path}")

    scan = scan_pdf_directory([cv_dir])
    run_dir = tmp_path / "run"
    with (
        IngestStateStore(run_dir / "state.sqlite") as store,
        BackendIngestClient(
            "http://backend.test",
            concurrency=1,
            max_retries=2,
            transport=httpx.MockTransport(handler),
            sleep_fn=lambda _sec: None,
        ) as client,
    ):
        store.initialize_or_verify_manifest(scan.items)
        first = run_ingestion(
            items=store.select_items(),
            client=client,
            store=store,
            run_dir=run_dir,
            concurrency=1,
            logger=logging.getLogger("test_retry1"),
        )
        assert first.succeeded == 1  # idx 2 succeeded on retry
        assert first.failed_retryable == 1  # idx 0 exhausted 503 retries
        assert first.failed_permanent == 1  # idx 1 got 400 BAD_REQUEST
        assert first.status_counts[STATUS_FAILED_RETRYABLE] == 1
        assert first.status_counts[STATUS_FAILED_PERMANENT] == 1

        # Now Backend recovers and --retry-failed picks up ONLY idx 0
        phase_fail_transient = False
        second = run_ingestion(
            items=store.select_items(retry_failed_only=True),
            client=client,
            store=store,
            run_dir=run_dir,
            concurrency=1,
            logger=logging.getLogger("test_retry2"),
        )
        assert second.processed == 1
        assert second.succeeded == 1
        assert second.status_counts[STATUS_CV_UPLOADED] == 2
        assert second.status_counts[STATUS_FAILED_PERMANENT] == 1
