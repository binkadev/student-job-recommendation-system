"""Unit tests for Company+Job API workflows and duplicate-title timeout safeguard."""

from __future__ import annotations

import csv
import json
import logging
from pathlib import Path

import httpx

from scripts.bulk_job_ingest import DEFAULT_SKILL_CATALOG_PATH
from scripts.bulk_job_ingest.client import BackendJobIngestClient
from scripts.bulk_job_ingest.csv_loader import load_job_csv
from scripts.bulk_job_ingest.skill_matcher import CanonicalSkillMatcher, sync_catalog_skills
from scripts.bulk_job_ingest.state_store import (
    COMPANY_VERIFIED,
    JOB_ACTIVE,
    JOB_CREATED_DRAFT,
    JobIngestStateStore,
)
from scripts.bulk_job_ingest.worker import (
    SharedJobDefaults,
    run_company_phase,
    run_job_phase,
)


def _ok(data: object, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json={"success": True, "message": "ok", "errorCode": None, "data": data},
    )


def test_full_flow_and_timeout_duplicate_safeguard_for_same_title(tmp_path: Path) -> None:
    # Two distinct jobs with IDENTICAL `name` ("Backend Developer") under the SAME company
    csv_path = tmp_path / "job.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name", "description", "requirment"])
        writer.writeheader()
        writer.writerow({"name": "Backend Developer", "description": "Team A Java API", "requirment": "Java"})
        writer.writerow({"name": "Backend Developer", "description": "Team B Python API", "requirment": "Python"})

    dataset = load_job_csv(csv_path)
    matcher = CanonicalSkillMatcher.from_catalog_file(DEFAULT_SKILL_CATALOG_PATH)
    run_dir = tmp_path / "run"

    next_job_id = 100
    created_jobs: dict[int, dict[str, object]] = {}
    post_job_calls = 0
    inject_timeout_on_second_post = True

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal next_job_id, post_job_calls, inject_timeout_on_second_post
        path = request.url.path
        if path == "/api/public/statistics":
            return _ok({"totalJobs": 0})
        if path == "/api/auth/register":
            return _ok({"id": 10}, status=201)
        if path == "/api/auth/login":
            body = json.loads(request.content.decode("utf-8"))
            tok = "admin-jwt" if body["email"] == "admin@example.com" else "comp-jwt"
            return _ok({"token": tok, "user": {"id": 1 if tok == "admin-jwt" else 10}})
        if path == "/api/companies/me":
            return _ok({"id": 500, "status": "PENDING"})
        if path == "/api/admin/companies/500/status":
            return _ok({"id": 500, "status": "VERIFIED"})
        if path == "/api/skills" and request.method == "GET":
            return _ok(
                {
                    "items": [
                        {"id": i + 1, "name": name, "normalizedName": name}
                        for i, name in enumerate(matcher.canonical_names)
                    ],
                    "totalPages": 1,
                }
            )
        if path == "/api/jobs" and request.method == "POST":
            post_job_calls += 1
            body = json.loads(request.content.decode("utf-8"))
            job_id = next_job_id
            next_job_id += 1
            created_jobs[job_id] = {
                "id": job_id,
                "companyId": body["companyId"],
                "title": body["title"],
                "description": body["description"],
                "requirements": body.get("requirements"),
                "status": body["status"],
            }
            # Simulate a committed DB insert whose HTTP response timed out on Job 2's 1st POST!
            if post_job_calls == 2 and inject_timeout_on_second_post:
                inject_timeout_on_second_post = False
                raise httpx.ReadTimeout("simulated post-commit read timeout", request=request)
            return _ok(created_jobs[job_id])
        if path == "/api/jobs" and request.method == "GET":
            st = request.url.params.get("status")
            matching = [j for j in created_jobs.values() if j["status"] == st]
            return _ok({"items": matching, "totalPages": 1})
        if path.startswith("/api/jobs/") and request.method == "GET":
            jid = int(path.rsplit("/", 1)[1])
            return _ok(created_jobs[jid])
        if path.startswith("/api/jobs/") and path.endswith("/status") and request.method == "PATCH":
            jid = int(path.split("/")[3])
            st = json.loads(request.content.decode("utf-8"))["status"]
            created_jobs[jid]["status"] = st
            return _ok(created_jobs[jid])
        raise AssertionError(f"Unhandled request: {request.method} {path}")

    with (
        JobIngestStateStore(run_dir / "state.sqlite") as store,
        BackendJobIngestClient(
            "http://backend.test",
            admin_email="admin@example.com",
            admin_password="123456",
            max_retries=0,  # let 1st timeout surface as FAILED_RETRYABLE, then test --retry-failed!
            transport=httpx.MockTransport(handler),
            sleep_fn=lambda _s: None,
        ) as client,
    ):
        store.initialize_or_verify_manifest(
            dataset, matcher=matcher, default_target_status="ACTIVE"
        )
        comp_out = run_company_phase(
            companies=store.select_companies(),
            client=client,
            store=store,
            concurrency=1,
            logger=logging.getLogger("test_comp"),
        )
        assert comp_out.succeeded == 1
        assert store.count_companies_by_status()[COMPANY_VERIFIED] == 1

        skill_map = sync_catalog_skills(
            client, admin_token=client.get_admin_token(), matcher=matcher
        )
        defaults = SharedJobDefaults(
            location="Ho Chi Minh City",
            job_type="FULL_TIME",
            working_model="ONSITE",
        )
        first_jobs = run_job_phase(
            jobs=store.select_jobs(),
            client=client,
            store=store,
            defaults=defaults,
            skill_id_map=skill_map,
            concurrency=1,
            logger=logging.getLogger("test_jobs_1"),
        )
        assert first_jobs.succeeded == 1
        assert first_jobs.failed_retryable == 1  # Job 2 timed out after Backend committed id=101

        # Retry Job 2: Job 1 already claimed id=100, so Job 2 MUST skip id=100, match id=101
        # via description equality ("Team B Python API"), NOT create id=102, and activate id=101!
        retry_jobs = run_job_phase(
            jobs=store.select_jobs(retry_failed_only=True),
            client=client,
            store=store,
            defaults=defaults,
            skill_id_map=skill_map,
            concurrency=1,
            logger=logging.getLogger("test_jobs_retry"),
        )
        assert retry_jobs.succeeded == 1
        assert post_job_calls == 2  # No duplicate 3rd POST!
        assert sorted(created_jobs.keys()) == [100, 101]
        assert created_jobs[100]["status"] == "ACTIVE"
        assert created_jobs[101]["status"] == "ACTIVE"
        assert store.count_jobs_by_status()[JOB_ACTIVE] == 2


def test_activate_limit_keeps_excess_jobs_as_draft(tmp_path: Path) -> None:
    csv_path = tmp_path / "job.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name", "description", "requirment"])
        writer.writeheader()
        writer.writerow({"name": "Job A", "description": "Desc A", "requirment": ""})
        writer.writerow({"name": "Job B", "description": "Desc B", "requirment": ""})

    dataset = load_job_csv(csv_path)
    matcher = CanonicalSkillMatcher.from_catalog_file(DEFAULT_SKILL_CATALOG_PATH)
    with JobIngestStateStore(tmp_path / "run" / "state.sqlite") as store:
        store.initialize_or_verify_manifest(
            dataset,
            matcher=matcher,
            default_target_status="ACTIVE",
            activate_limit=1,
        )
        jobs = store.select_jobs()
        assert [j.target_status for j in jobs] == ["ACTIVE", "DRAFT"]
        assert JOB_CREATED_DRAFT != JOB_ACTIVE
