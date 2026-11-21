"""Concurrent Phase 1 (Companies) & Phase 2 (Jobs) ingestion workers."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import logging
import time
from typing import Any

from . import DEFAULT_COMPANY_PASSWORD
from .client import (
    BackendJobIngestClient,
    EmailAlreadyExistsError,
    JobIngestApiError,
)
from .state_store import (
    COMPANY_IDENTIFIED,
    COMPANY_PENDING,
    COMPANY_VERIFIED,
    JOB_ACTIVE,
    JOB_CREATED_DRAFT,
    JOB_CREATED_PENDING,
    CompanyItem,
    JobIngestStateStore,
    JobItem,
)


@dataclass(frozen=True, slots=True)
class SharedJobDefaults:
    location: str | None
    job_type: str
    working_model: str
    benefits: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    currency: str | None = None
    deadline: str | None = None


@dataclass(frozen=True, slots=True)
class PhaseOutcome:
    processed: int
    succeeded: int
    failed_retryable: int
    failed_permanent: int
    elapsed_seconds: float


def _process_company(
    item: CompanyItem,
    *,
    client: BackendJobIngestClient,
    store: JobIngestStateStore,
    logger: logging.Logger,
    password: str = DEFAULT_COMPANY_PASSWORD,
) -> str:
    attempts = item.attempts + 1
    user_id = item.user_id
    company_id = item.company_id

    try:
        # 1. Register Company account (idempotent on 409 EMAIL_ALREADY_EXISTS)
        if item.status in (COMPANY_PENDING, "FAILED_RETRYABLE") and company_id is None:
            try:
                user_id = client.register_company(
                    email=item.email,
                    password=password,
                    full_name=item.full_name,
                    company_name=item.company_name,
                )
                store.mark_company_registered(item.company_idx, user_id=user_id)
            except EmailAlreadyExistsError:
                store.mark_company_registered(item.company_idx, user_id=user_id)

        # 2. Login as Company + GET /api/companies/me -> exact company_id & status
        current_status = ""
        if company_id is None or item.status in (COMPANY_IDENTIFIED, "FAILED_RETRYABLE"):
            comp_token, login_uid = client.login(
                email=item.email, password=password
            )
            if login_uid is not None:
                user_id = login_uid
            company_id, current_status = client.get_company_me(token=comp_token)
            store.mark_company_identified(
                item.company_idx, company_id=company_id
            )

        assert company_id is not None
        if current_status != COMPANY_VERIFIED:
            client.verify_company_as_admin(
                company_id=company_id, status=COMPANY_VERIFIED
            )

        store.mark_company_verified(
            item.company_idx, company_id=company_id, attempts=attempts
        )
        return "VERIFIED"

    except JobIngestApiError as exc:
        store.mark_company_failed(
            item.company_idx,
            retryable=exc.retryable,
            attempts=attempts,
            http_status=exc.http_status,
            error_code=exc.error_code,
            error_msg=exc.message,
        )
        logger.warning(
            "company_idx=%s email=%s failed retryable=%s code=%s http=%s msg=%s",
            item.company_idx,
            item.email,
            exc.retryable,
            exc.error_code,
            exc.http_status,
            exc.message,
        )
        return "FAILED_RETRYABLE" if exc.retryable else "FAILED_PERMANENT"
    except Exception as exc:
        store.mark_company_failed(
            item.company_idx,
            retryable=True,
            attempts=attempts,
            http_status=None,
            error_code=type(exc).__name__,
            error_msg=str(exc),
        )
        logger.warning(
            "company_idx=%s email=%s unexpected=%s msg=%s",
            item.company_idx,
            item.email,
            type(exc).__name__,
            exc,
        )
        return "FAILED_RETRYABLE"


def _recover_unclaimed_job_if_committed(
    item: JobItem,
    *,
    client: BackendJobIngestClient,
    store: JobIngestStateStore,
    attempts: int,
) -> tuple[int, str] | None:
    """Safeguard: recover only an unclaimed orphan job matching companyId, title, AND description+requirements."""
    assert item.company_id is not None
    keyword = item.title[:80].strip()
    statuses_to_check = (
        ("PENDING_APPROVAL", "ACTIVE")
        if item.target_status == "ACTIVE"
        else ("DRAFT", "PENDING_APPROVAL", "ACTIVE")
    )
    expected_desc = item.description.strip()
    expected_req = (item.requirements or "").strip()

    for status_filter in statuses_to_check:
        page = 1
        while True:
            summaries, total_pages = client.search_jobs_as_admin(
                keyword=keyword,
                status=status_filter,
                page=page,
                size=100,
            )
            claimed_ids = store.get_claimed_job_ids()
            for summary in summaries:
                raw_id = summary.get("id")
                if raw_id is None:
                    continue
                candidate_id = int(raw_id)
                if candidate_id in claimed_ids:
                    continue
                if summary.get("companyId") != item.company_id:
                    continue
                if summary.get("title") != item.title:
                    continue

                detail = client.get_job_detail_as_admin(job_id=candidate_id)
                if (detail.get("description") or "").strip() != expected_desc:
                    continue
                if (detail.get("requirements") or "").strip() != expected_req:
                    continue

                detail_status = str(detail.get("status") or status_filter)
                local_status = (
                    JOB_ACTIVE
                    if detail_status == "ACTIVE"
                    else (
                        JOB_CREATED_DRAFT
                        if detail_status == "DRAFT"
                        else JOB_CREATED_PENDING
                    )
                )
                if store.try_claim_existing_job(
                    item.job_row_idx,
                    job_id=candidate_id,
                    status=local_status,
                    attempts=attempts,
                ):
                    return candidate_id, detail_status
            if page >= max(1, total_pages):
                break
            page += 1
    return None


def _build_create_job_payload(
    item: JobItem,
    *,
    defaults: SharedJobDefaults,
    skill_id_map: dict[str, int],
) -> dict[str, Any]:
    assert item.company_id is not None
    create_status = (
        "PENDING_APPROVAL" if item.target_status == "ACTIVE" else "DRAFT"
    )
    skills_payload = [
        {"skillId": skill_id_map[canonical], "importance": "REQUIRED"}
        for canonical in item.skills_canonical
        if canonical in skill_id_map
    ]
    payload: dict[str, Any] = {
        "companyId": item.company_id,
        "title": item.title,
        "description": item.description,
        "jobType": defaults.job_type,
        "workingModel": defaults.working_model,
        "status": create_status,
        "skills": skills_payload,
    }
    if item.requirements is not None:
        payload["requirements"] = item.requirements
    if defaults.benefits is not None:
        payload["benefits"] = defaults.benefits
    if defaults.location is not None:
        payload["location"] = defaults.location
    if defaults.salary_min is not None:
        payload["salaryMin"] = defaults.salary_min
    if defaults.salary_max is not None:
        payload["salaryMax"] = defaults.salary_max
    if defaults.currency is not None:
        payload["currency"] = defaults.currency
    if defaults.deadline is not None:
        payload["deadline"] = defaults.deadline
    return payload


def _process_job(
    item: JobItem,
    *,
    client: BackendJobIngestClient,
    store: JobIngestStateStore,
    defaults: SharedJobDefaults,
    skill_id_map: dict[str, int],
    logger: logging.Logger,
) -> str:
    attempts = item.attempts + 1
    if item.company_id is None:
        store.mark_job_failed(
            item.job_row_idx,
            retryable=True,
            attempts=attempts,
            http_status=None,
            error_code="COMPANY_NOT_VERIFIED",
            error_msg=f"Company idx={item.company_idx} has no verified company_id yet",
        )
        return "FAILED_RETRYABLE"

    try:
        job_id = item.job_id
        remote_status = (
            "PENDING_APPROVAL"
            if item.status == JOB_CREATED_PENDING
            else ""
        )

        # Safeguard on timeout retry: only recover unclaimed orphan job matching description+requirements
        if job_id is None and item.attempts > 0:
            recovered = _recover_unclaimed_job_if_committed(
                item, client=client, store=store, attempts=attempts
            )
            if recovered is not None:
                job_id, remote_status = recovered

        if job_id is None:
            payload = _build_create_job_payload(
                item, defaults=defaults, skill_id_map=skill_id_map
            )
            job_id = client.create_job_as_admin(payload=payload)
            if item.target_status == "DRAFT":
                store.mark_job_done(
                    item.job_row_idx,
                    job_id=job_id,
                    final_status=JOB_CREATED_DRAFT,
                    attempts=attempts,
                )
                return "SUCCESS"
            store.mark_job_created_pending(
                item.job_row_idx, job_id=job_id, attempts=attempts
            )
            remote_status = "PENDING_APPROVAL"

        if item.target_status == "ACTIVE":
            if remote_status != "ACTIVE":
                client.update_job_status_as_admin(job_id=job_id, status="ACTIVE")
            store.mark_job_done(
                item.job_row_idx,
                job_id=job_id,
                final_status=JOB_ACTIVE,
                attempts=attempts,
            )
        else:
            store.mark_job_done(
                item.job_row_idx,
                job_id=job_id,
                final_status=JOB_CREATED_DRAFT,
                attempts=attempts,
            )
        return "SUCCESS"

    except JobIngestApiError as exc:
        store.mark_job_failed(
            item.job_row_idx,
            retryable=exc.retryable,
            attempts=attempts,
            http_status=exc.http_status,
            error_code=exc.error_code,
            error_msg=exc.message,
        )
        logger.warning(
            "job_row_idx=%s csv_line=%s failed retryable=%s code=%s http=%s msg=%s",
            item.job_row_idx,
            item.csv_line_number,
            exc.retryable,
            exc.error_code,
            exc.http_status,
            exc.message,
        )
        return "FAILED_RETRYABLE" if exc.retryable else "FAILED_PERMANENT"
    except Exception as exc:
        store.mark_job_failed(
            item.job_row_idx,
            retryable=True,
            attempts=attempts,
            http_status=None,
            error_code=type(exc).__name__,
            error_msg=str(exc),
        )
        logger.warning(
            "job_row_idx=%s csv_line=%s unexpected=%s msg=%s",
            item.job_row_idx,
            item.csv_line_number,
            type(exc).__name__,
            exc,
        )
        return "FAILED_RETRYABLE"


def run_company_phase(
    *,
    companies: list[CompanyItem],
    client: BackendJobIngestClient,
    store: JobIngestStateStore,
    concurrency: int,
    logger: logging.Logger,
) -> PhaseOutcome:
    started = time.perf_counter()
    succeeded = retryable = permanent = 0
    total = len(companies)
    if total > 0:
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            futures = [
                executor.submit(
                    _process_company,
                    comp,
                    client=client,
                    store=store,
                    logger=logger,
                )
                for comp in companies
            ]
            done = 0
            for future in as_completed(futures):
                result = future.result()
                done += 1
                if result == "VERIFIED":
                    succeeded += 1
                elif result == "FAILED_RETRYABLE":
                    retryable += 1
                else:
                    permanent += 1
                if done % 100 == 0 or done == total:
                    elapsed = time.perf_counter() - started
                    rate = done / elapsed if elapsed > 0 else 0.0
                    logger.info(
                        "companies_progress=%d/%d verified=%d retryable=%d permanent=%d rate=%.2f/s",
                        done,
                        total,
                        succeeded,
                        retryable,
                        permanent,
                        rate,
                    )
    return PhaseOutcome(
        processed=total,
        succeeded=succeeded,
        failed_retryable=retryable,
        failed_permanent=permanent,
        elapsed_seconds=time.perf_counter() - started,
    )


def run_job_phase(
    *,
    jobs: list[JobItem],
    client: BackendJobIngestClient,
    store: JobIngestStateStore,
    defaults: SharedJobDefaults,
    skill_id_map: dict[str, int],
    concurrency: int,
    logger: logging.Logger,
) -> PhaseOutcome:
    started = time.perf_counter()
    succeeded = retryable = permanent = 0
    total = len(jobs)
    if total > 0:
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            futures = [
                executor.submit(
                    _process_job,
                    job,
                    client=client,
                    store=store,
                    defaults=defaults,
                    skill_id_map=skill_id_map,
                    logger=logger,
                )
                for job in jobs
            ]
            done = 0
            for future in as_completed(futures):
                result = future.result()
                done += 1
                if result == "SUCCESS":
                    succeeded += 1
                elif result == "FAILED_RETRYABLE":
                    retryable += 1
                else:
                    permanent += 1
                if done % 250 == 0 or done == total:
                    elapsed = time.perf_counter() - started
                    rate = done / elapsed if elapsed > 0 else 0.0
                    logger.info(
                        "jobs_progress=%d/%d completed=%d retryable=%d permanent=%d rate=%.2f/s",
                        done,
                        total,
                        succeeded,
                        retryable,
                        permanent,
                        rate,
                    )
    return PhaseOutcome(
        processed=total,
        succeeded=succeeded,
        failed_retryable=retryable,
        failed_permanent=permanent,
        elapsed_seconds=time.perf_counter() - started,
    )
