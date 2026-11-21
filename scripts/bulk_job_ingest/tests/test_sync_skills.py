"""Unit tests for API-based Canonical Skill & job_skills Re-Sync tool."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx

from scripts.bulk_job_ingest.client import BackendJobIngestClient
from scripts.bulk_job_ingest.skill_matcher import CanonicalSkillMatcher
from scripts.bulk_job_ingest.sync_skills import (
    SYNC_ACTIVE,
    SYNC_EXPIRED,
    SYNC_FAILED_RETRYABLE,
    SYNC_SKIPPED_UNCHANGED,
    SYNC_SUBMITTED,
    SkillResyncStateStore,
    main as sync_main,
    run_job_resync_phase,
)


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


def _mini_catalog(tmp_path: Path, extra_count: int = 0) -> Path:
    skills = [
        {"canonical": "java", "aliases": ["java"]},
        {"canonical": "spring boot", "aliases": ["spring boot", "springboot"]},
        {"canonical": "docker", "aliases": ["docker"]},
        {"canonical": "kubernetes", "aliases": ["kubernetes", "k8s"]},
    ]
    for i in range(extra_count):
        name = f"skill{i:03d}"
        skills.append({"canonical": name, "aliases": [name]})
    path = tmp_path / "catalog.json"
    path.write_text(
        json.dumps({"catalogVersion": "skills-v1", "skills": skills}),
        encoding="utf-8",
    )
    return path


class _MockBackend:
    """Enforces JobModerationPolicy + SkillController + UpdateJobRequest contracts."""

    def __init__(self, *, catalog_names: tuple[str, ...]) -> None:
        self.skills: dict[str, dict[str, object]] = {
            "java": {"id": 1, "name": "java", "normalizedName": "java", "category": "IT"},
        }
        self.next_skill_id = 2
        self.jobs: dict[int, dict[str, object]] = {}
        self.transitions: dict[int, list[str]] = {}
        self.put_payloads: dict[int, list[dict[str, object]]] = {}
        self.catalog_names = catalog_names
        self.fail_once_on: tuple[int, str] | None = None

    def add_job(
        self,
        job_id: int,
        *,
        title: str,
        description: str,
        requirements: str = "",
        status: str = "ACTIVE",
        skill_names: list[str] | None = None,
    ) -> None:
        skills_list = []
        for sname in skill_names or []:
            row = self.skills[sname]
            skills_list.append(
                {
                    "id": 1000 + int(row["id"]),  # type: ignore[arg-type]
                    "skillId": row["id"],
                    "skillName": row["name"],
                    "normalizedName": row["normalizedName"],
                    "category": "IT",
                    "importance": "PREFERRED" if sname == "java" else "REQUIRED",
                    "minLevel": "INTERMEDIATE" if sname == "java" else None,
                }
            )
        self.jobs[job_id] = {
            "id": job_id,
            "companyId": 10,
            "title": title,
            "description": description,
            "requirements": requirements,
            "benefits": "Insurance",
            "location": "Ho Chi Minh City",
            "jobType": "FULL_TIME",
            "workingModel": "ONSITE",
            "status": status,
            "publishedAt": "2026-11-19T10:00:00",
            "closedAt": None,
            "skills": skills_list,
        }
        self.transitions[job_id] = []
        self.put_payloads[job_id] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/api/public/statistics":
            return _ok({"totalJobs": len(self.jobs)})
        if path == "/api/auth/login":
            return _ok({"token": "admin-jwt", "user": {"id": 1}})
        assert request.headers.get("Authorization") == "Bearer admin-jwt"

        if path == "/api/skills" and request.method == "GET":
            page = int(request.url.params.get("page", "1"))
            size = int(request.url.params.get("size", "100"))
            all_rows = sorted(self.skills.values(), key=lambda r: str(r["name"]))
            total_pages = max(1, (len(all_rows) + size - 1) // size)
            chunk = all_rows[(page - 1) * size : page * size]
            return _ok({"items": chunk, "totalPages": total_pages, "page": page, "size": size})

        if path == "/api/skills" and request.method == "POST":
            body = json.loads(request.content.decode("utf-8"))
            norm = " ".join(str(body["name"]).split()).casefold()
            if norm in self.skills:
                return _err(400, "BAD_REQUEST", "Skill already exists")
            row = {
                "id": self.next_skill_id,
                "name": norm,
                "normalizedName": norm,
                "category": body.get("category"),
            }
            self.skills[norm] = row
            self.next_skill_id += 1
            return _ok(row, status=201)

        if path == "/api/jobs" and request.method == "GET":
            st = request.url.params.get("status")
            page = int(request.url.params.get("page", "1"))
            size = int(request.url.params.get("size", "100"))
            matched = [j for j in sorted(self.jobs.values(), key=lambda r: int(r["id"])) if st is None or j["status"] == st]  # type: ignore[arg-type]
            total_pages = max(1, (len(matched) + size - 1) // size)
            return _ok({"items": matched[(page - 1) * size : page * size], "totalPages": total_pages})

        if path.startswith("/api/jobs/") and request.method == "GET":
            jid = int(path.rsplit("/", 1)[1])
            return _ok(self.jobs[jid])

        if path.startswith("/api/jobs/") and path.endswith("/status") and request.method == "PATCH":
            jid = int(path.split("/")[3])
            target = json.loads(request.content.decode("utf-8"))["status"]
            if self.fail_once_on == (jid, target):
                self.fail_once_on = None
                raise httpx.ReadTimeout("simulated transient status error", request=request)
            job = self.jobs[jid]
            cur = str(job["status"])
            valid = {
                ("ACTIVE", "EXPIRED"),
                ("EXPIRED", "DRAFT"),
                ("CLOSED", "DRAFT"),
                ("PENDING_APPROVAL", "DRAFT"),
                ("DRAFT", "PENDING_APPROVAL"),
                ("PENDING_APPROVAL", "ACTIVE"),
            }
            if (cur, target) not in valid:
                return _err(400, "BAD_REQUEST", f"Invalid job status transition: {cur} -> {target}")
            job["status"] = target
            self.transitions[jid].append(target)
            return _ok(job)

        if path.startswith("/api/jobs/") and request.method == "PUT":
            jid = int(path.rsplit("/", 1)[1])
            job = self.jobs[jid]
            if job["status"] != "DRAFT":
                return _err(400, "BAD_REQUEST", "Return the job to draft before editing its content")
            body = json.loads(request.content.decode("utf-8"))
            self.put_payloads[jid].append(body)
            by_id = {int(v["id"]): v for v in self.skills.values()}  # type: ignore[arg-type]
            new_skills = []
            for sreq in body["skills"]:
                srow = by_id[int(sreq["skillId"])]
                new_skills.append(
                    {
                        "id": 2000 + int(srow["id"]),  # type: ignore[arg-type]
                        "skillId": srow["id"],
                        "skillName": srow["name"],
                        "normalizedName": srow["normalizedName"],
                        "category": srow["category"],
                        "importance": sreq.get("importance") or "REQUIRED",
                        "minLevel": sreq.get("minLevel"),
                    }
                )
            job["skills"] = new_skills
            return _ok(job)

        raise AssertionError(f"Unhandled request: {request.method} {path}")


def test_five_step_transition_diff_skip_and_idempotent_draft_crash_recovery(
    tmp_path: Path,
) -> None:
    cat_path = _mini_catalog(tmp_path)
    matcher = CanonicalSkillMatcher.from_catalog_file(cat_path)
    mock = _MockBackend(catalog_names=matcher.canonical_names)

    # Seed pre-existing skills so docker/k8s already exist for crash-recovery job tests
    for name in ("docker", "kubernetes"):
        mock.skills[name] = {
            "id": mock.next_skill_id,
            "name": name,
            "normalizedName": name,
            "category": "IT",
        }
        mock.next_skill_id += 1

    # Job 1: ACTIVE, stale skills -> needs full 5-step transition + adds spring boot & k8s -> kubernetes
    mock.add_job(
        1,
        title="Backend Java",
        description="Use Java, SpringBoot, and K8s.",
        status="ACTIVE",
        skill_names=["java"],
    )
    # Job 2: ACTIVE, already has exact desired skills -> Diff-Skip (ZERO write calls!)
    mock.add_job(
        2,
        title="Docker Ops",
        description="Maintain Docker clusters.",
        status="ACTIVE",
        skill_names=["docker"],
    )
    # Job 3: Crashed in EXPIRED -> resumes DRAFT -> PUT -> PENDING_APPROVAL -> ACTIVE
    mock.add_job(
        3,
        title="Java K8s",
        description="Java with Kubernetes.",
        status="EXPIRED",
        skill_names=["java"],
    )
    # Job 4: Crashed in DRAFT right after PUT succeeded -> skips redundant PUT! Runs PENDING_APPROVAL -> ACTIVE
    mock.add_job(
        4,
        title="Docker Java",
        description="Java and Docker.",
        status="DRAFT",
        skill_names=["docker", "java"],
    )
    # Job 5: Crashed in PENDING_APPROVAL with desired skills -> only runs ACTIVE!
    mock.add_job(
        5,
        title="K8s Engineer",
        description="Kubernetes platform.",
        status="PENDING_APPROVAL",
        skill_names=["kubernetes"],
    )

    run_dir = tmp_path / "run"
    with (
        BackendJobIngestClient(
            "http://backend.test",
            admin_email="admin@example.com",
            admin_password="123456",
            max_retries=0,
            transport=httpx.MockTransport(mock.handler),
            sleep_fn=lambda _s: None,
        ) as client,
        SkillResyncStateStore(run_dir / "state.sqlite") as store,
    ):
        from scripts.bulk_job_ingest.skill_matcher import sync_catalog_skills

        skill_id_map = sync_catalog_skills(
            client, admin_token=client.get_admin_token(), matcher=matcher
        )
        # "spring boot" should have been seeded via POST /api/skills
        assert "spring boot" in skill_id_map

        store.initialize_or_resume_jobs(
            lambda: [1, 2, 3, 4, 5],
            source_mode="api",
            catalog_sha256="abc",
            skill_category="IT",
        )
        outcome = run_job_resync_phase(
            jobs=store.select_jobs(),
            client=client,
            store=store,
            matcher=matcher,
            skill_id_map=skill_id_map,
            concurrency=1,
            logger=logging.getLogger("test_sync"),
        )

    assert outcome.updated_active == 4
    assert outcome.skipped_unchanged == 1

    # Job 1: full 5-step transition + ONLY {"skills": [...]} in PUT + metadata preserved + closedAt None
    assert mock.transitions[1] == ["EXPIRED", "DRAFT", "PENDING_APPROVAL", "ACTIVE"]
    assert len(mock.put_payloads[1]) == 1
    assert list(mock.put_payloads[1][0].keys()) == ["skills"]
    assert mock.jobs[1]["closedAt"] is None
    assert mock.jobs[1]["publishedAt"] == "2026-11-19T10:00:00"
    assert sorted(s["normalizedName"] for s in mock.jobs[1]["skills"]) == [  # type: ignore[attr-defined]
        "java",
        "kubernetes",
        "spring boot",
    ]
    # Preserved existing skill importance/minLevel on "java"!
    java_entry = [s for s in mock.jobs[1]["skills"] if s["normalizedName"] == "java"][0]  # type: ignore[index]
    assert java_entry["importance"] == "PREFERRED"
    assert java_entry["minLevel"] == "INTERMEDIATE"

    # Job 2: zero writes
    assert mock.transitions[2] == []
    assert mock.put_payloads[2] == []

    # Job 3: resumed from EXPIRED
    assert mock.transitions[3] == ["DRAFT", "PENDING_APPROVAL", "ACTIVE"]
    assert len(mock.put_payloads[3]) == 1

    # Job 4: resumed from DRAFT with matching skills -> skipped redundant PUT!
    assert mock.transitions[4] == ["PENDING_APPROVAL", "ACTIVE"]
    assert mock.put_payloads[4] == []

    # Job 5: resumed from PENDING_APPROVAL
    assert mock.transitions[5] == ["ACTIVE"]
    assert mock.put_payloads[5] == []


def test_deterministic_100_skill_cap_and_retry_failed_resumption(
    tmp_path: Path, monkeypatch
) -> None:
    cat_path = _mini_catalog(tmp_path, extra_count=120)
    matcher = CanonicalSkillMatcher.from_catalog_file(cat_path)
    mock = _MockBackend(catalog_names=matcher.canonical_names)

    many_skills_text = " ".join(f"skill{i:03d}" for i in range(115)) + " Java"
    mock.add_job(10, title="Polyglot", description=many_skills_text, status="ACTIVE", skill_names=[])
    # Simulate network timeout on Job 10's DRAFT -> PENDING_APPROVAL call, leaving Job 10 in DRAFT
    mock.fail_once_on = (10, "PENDING_APPROVAL")

    orig_init = BackendJobIngestClient.__init__

    def _patched_client_init(self, *args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(mock.handler)
        kwargs["sleep_fn"] = lambda _s: None
        return orig_init(self, *args, **kwargs)

    monkeypatch.setattr(BackendJobIngestClient, "__init__", _patched_client_init)

    # 1. Dry run reports missing skills & over-100 cap cleanly without mutating
    rc_dry = sync_main(
        [
            "--skill-catalog-path", str(cat_path),
            "--runs-dir", str(tmp_path / "runs"),
            "--run-name", "r1",
            "--dry-run",
        ]
    )
    assert rc_dry == 0
    assert mock.transitions[10] == []

    # 2. First real run seeds missing skills + hits simulated failure right after PUT (leaving Job 10 in DRAFT!)
    rc_fail = sync_main(
        [
            "--skill-catalog-path", str(cat_path),
            "--runs-dir", str(tmp_path / "runs"),
            "--run-name", "r1",
            "--max-retries", "0",
            "--skill-concurrency", "2",
            "--job-concurrency", "1",
        ]
    )
    assert rc_fail == 2
    assert mock.jobs[10]["status"] == "DRAFT"
    assert len(mock.put_payloads[10]) == 1

    # 3. Retry failed resumes cleanly from DRAFT, sees 100 skills already persisted -> SKIPS redundant PUT & activates!
    rc_retry = sync_main(
        [
            "--skill-catalog-path", str(cat_path),
            "--runs-dir", str(tmp_path / "runs"),
            "--run-name", "r1",
            "--retry-failed",
            "--job-concurrency", "1",
        ]
    )
    assert rc_retry == 0
    assert mock.jobs[10]["status"] == "ACTIVE"
    assert len(mock.put_payloads[10]) == 1  # No duplicate PUT on retry!
    assert len(mock.jobs[10]["skills"]) == 100  # type: ignore[arg-type]
    # Sorted canonical[:100] -> "java" + "skill000".."skill098"
    expected_100 = sorted(["java", *(f"skill{i:03d}" for i in range(99))])
    actual_100 = sorted(s["normalizedName"] for s in mock.jobs[10]["skills"])  # type: ignore[attr-defined]
    assert actual_100 == expected_100
