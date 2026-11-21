"""Unit tests for SQLite manifest locking, slicing, resume, and reporting."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from scripts.bulk_ingest.scanner import scan_pdf_directory
from scripts.bulk_ingest.state_store import (
    STATUS_CV_UPLOADED,
    STATUS_FAILED_PERMANENT,
    STATUS_FAILED_RETRYABLE,
    STATUS_PENDING,
    STATUS_REGISTERED,
    IngestStateStore,
    ManifestMismatchError,
)

_MINIMAL_PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


def _make_dataset(root: Path, count: int = 4) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    for idx in range(count):
        (root / f"cv_{idx:02d}.pdf").write_bytes(_MINIMAL_PDF + f"% {idx}\n".encode())
    return root


def test_manifest_locks_and_verifies_on_rerun(tmp_path: Path) -> None:
    cv_dir = _make_dataset(tmp_path / "cvs", count=3)
    db_path = tmp_path / "run" / "state.sqlite"

    scan = scan_pdf_directory([cv_dir])
    with IngestStateStore(db_path) as store:
        assert store.initialize_or_verify_manifest(scan.items) == "initialized"
        assert store.initialize_or_verify_manifest(scan.items) == "verified"

    # Adding a new file to the scanned directory must fail manifest verification.
    (cv_dir / "cv_00_extra.pdf").write_bytes(_MINIMAL_PDF)
    shifted_scan = scan_pdf_directory([cv_dir])
    with IngestStateStore(db_path) as store:
        with pytest.raises(ManifestMismatchError):
            store.initialize_or_verify_manifest(shifted_scan.items)


def test_manifest_rejects_modified_pdf_content(tmp_path: Path) -> None:
    cv_dir = _make_dataset(tmp_path / "cvs", count=2)
    db_path = tmp_path / "run" / "state.sqlite"
    scan = scan_pdf_directory([cv_dir])
    with IngestStateStore(db_path) as store:
        store.initialize_or_verify_manifest(scan.items)

    (cv_dir / "cv_01.pdf").write_bytes(_MINIMAL_PDF + b"% modified\n")
    modified_scan = scan_pdf_directory([cv_dir])
    with IngestStateStore(db_path) as store:
        with pytest.raises(ManifestMismatchError, match="sha256 mismatch"):
            store.initialize_or_verify_manifest(modified_scan.items)


def test_select_items_slicing_retry_filter_and_reports(tmp_path: Path) -> None:
    cv_dir = _make_dataset(tmp_path / "cvs", count=4)
    (cv_dir / "cv_03.pdf").write_bytes(b"corrupt")  # pre-check permanent failure
    run_dir = tmp_path / "run"
    db_path = run_dir / "state.sqlite"
    scan = scan_pdf_directory([cv_dir])

    with IngestStateStore(db_path) as store:
        store.initialize_or_verify_manifest(scan.items)
        pilot = store.select_items(offset=0, limit=2)
        assert [item.idx for item in pilot] == [0, 1]

        store.mark_cv_uploaded(0, user_id=10, cv_id=100, attempts=1)
        store.mark_failed(
            1,
            retryable=True,
            attempts=2,
            http_status=503,
            error_code="SERVICE_UNAVAILABLE",
            error_msg="temporary timeout",
            user_id=11,
        )

        # Normal selection picks remaining PENDING (2) + FAILED_RETRYABLE (1), skips CV_UPLOADED (0) & PERMANENT (3)
        resumed = store.select_items()
        assert [item.idx for item in resumed] == [1, 2]

        # --retry-failed picks ONLY FAILED_RETRYABLE (1)
        retry_only = store.select_items(retry_failed_only=True)
        assert [item.idx for item in retry_only] == [1]

        summary_path, failures_path, payload = store.export_reports(
            run_dir,
            elapsed_seconds=1.5,
            processed_in_invocation=2,
        )
        assert summary_path.is_file()
        assert failures_path.is_file()
        parsed_summary = json.loads(summary_path.read_text(encoding="utf-8"))
        assert parsed_summary["statusCounts"] == {
            STATUS_PENDING: 1,
            STATUS_REGISTERED: 0,
            STATUS_CV_UPLOADED: 1,
            STATUS_FAILED_RETRYABLE: 1,
            STATUS_FAILED_PERMANENT: 1,
        }
        with failures_path.open("r", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        assert [int(r["idx"]) for r in rows] == [1, 3]
        assert payload["totalManifestItems"] == 4
