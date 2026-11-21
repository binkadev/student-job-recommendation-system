"""Unit tests for dual-table SQLite WAL state store & atomic job_id claiming."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from scripts.bulk_job_ingest import DEFAULT_SKILL_CATALOG_PATH
from scripts.bulk_job_ingest.csv_loader import load_job_csv
from scripts.bulk_job_ingest.skill_matcher import CanonicalSkillMatcher
from scripts.bulk_job_ingest.state_store import (
    JOB_ACTIVE,
    JOB_FAILED_RETRYABLE,
    JobIngestStateStore,
    ManifestMismatchError,
)


def _sample_csv(path: Path) -> Path:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name", "description", "requirment"])
        writer.writeheader()
        writer.writerow({"name": "Backend Engineer", "description": "Java Spring Boot", "requirment": "Docker"})
        writer.writerow({"name": "Backend Engineer", "description": "Python FastAPI", "requirment": "PostgreSQL"})
    return path


def test_manifest_lock_atomic_job_claim_and_reports(tmp_path: Path) -> None:
    csv_file = _sample_csv(tmp_path / "job.csv")
    dataset = load_job_csv(csv_file)
    matcher = CanonicalSkillMatcher.from_catalog_file(DEFAULT_SKILL_CATALOG_PATH)
    run_dir = tmp_path / "run"

    with JobIngestStateStore(run_dir / "state.sqlite") as store:
        assert (
            store.initialize_or_verify_manifest(
                dataset, matcher=matcher, default_target_status="ACTIVE"
            )
            == "initialized"
        )
        assert (
            store.initialize_or_verify_manifest(
                dataset, matcher=matcher, default_target_status="ACTIVE"
            )
            == "verified"
        )

        # Row 0 claims job_id=700; Row 1 must NOT be allowed to claim job_id=700
        assert store.try_claim_existing_job(0, job_id=700, status=JOB_ACTIVE, attempts=1) is True
        assert store.try_claim_existing_job(1, job_id=700, status=JOB_ACTIVE, attempts=1) is False
        assert store.get_claimed_job_ids() == {700}

        store.mark_job_failed(
            1,
            retryable=True,
            attempts=1,
            http_status=503,
            error_code="HTTP_503",
            error_msg="unavailable",
        )
        retry_jobs = store.select_jobs(retry_failed_only=True)
        assert [j.job_row_idx for j in retry_jobs] == [1]

        summary_path, failures_path, payload = store.export_reports(
            run_dir, elapsed_seconds=2.0
        )
        assert summary_path.is_file() and failures_path.is_file()
        assert json.loads(summary_path.read_text(encoding="utf-8"))["jobStatusCounts"][JOB_FAILED_RETRYABLE] == 1
        assert payload["jobStatusCounts"][JOB_ACTIVE] == 1

    # Adding a CSV row must fail manifest verification
    with csv_file.open("a", encoding="utf-8", newline="") as handle:
        csv.writer(handle).writerow(["DevOps", "K8s", "AWS"])
    changed = load_job_csv(csv_file)
    with JobIngestStateStore(run_dir / "state.sqlite") as store:
        with pytest.raises(ManifestMismatchError):
            store.initialize_or_verify_manifest(
                changed, matcher=matcher, default_target_status="ACTIVE"
            )
