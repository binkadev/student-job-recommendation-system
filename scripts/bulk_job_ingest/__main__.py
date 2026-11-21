"""CLI entrypoint for safe, resumable bulk Company verification & Job CSV ingestion."""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
import sys
import time
from typing import Sequence

from . import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_BASE_URL,
    DEFAULT_COMPANY_CONCURRENCY,
    DEFAULT_CSV_PATH,
    DEFAULT_JOB_CONCURRENCY,
    DEFAULT_JOB_TYPE,
    DEFAULT_LOCATION,
    DEFAULT_MAX_RETRIES,
    DEFAULT_RUNS_DIR,
    DEFAULT_SKILL_CATALOG_PATH,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_WORKING_MODEL,
)
from .client import BackendJobIngestClient
from .csv_loader import CsvDataset, load_job_csv
from .skill_matcher import CanonicalSkillMatcher, sync_catalog_skills
from .state_store import JobIngestStateStore
from .worker import SharedJobDefaults, run_company_phase, run_job_phase


def _configure_utf8_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _build_logger(run_dir: Path, *, write_file_log: bool) -> logging.Logger:
    logger = logging.getLogger("bulk_job_ingest")
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


def _print_dry_run_report(
    dataset: CsvDataset,
    *,
    manifest_state: str,
    offset: int,
    limit: int | None,
    target_status: str,
    activate_limit: int | None,
) -> None:
    s = dataset.stats
    print("=== Bulk Company & Job Ingestion Dry Run (No HTTP Calls Executed) ===")
    print(f"Manifest check              : {manifest_state}")
    print(f"CSV encoding                : {s.encoding_used}")
    print(f"Total CSV data rows         : {s.total_csv_rows}")
    print(f"Valid job rows              : {s.valid_job_rows}")
    print(f"Unique grouped companies    : {s.unique_companies}")
    print(f"Blank `name` skipped        : {s.blank_name_skipped}")
    print(f"Blank `description` skipped : {s.blank_description_skipped}")
    print(f"Truncated `name` (>255)     : {s.truncated_name_count}")
    print(f"Truncated `description`     : {s.truncated_description_count}")
    print(f"Truncated `requirment`      : {s.truncated_requirements_count}")
    print(
        f"Target status policy        : {target_status}"
        + (f" (activate_limit={activate_limit})" if activate_limit is not None else "")
    )

    if dataset.companies:
        c0 = dataset.companies[0]
        c_last = dataset.companies[-1]
        print(f"First company               : idx={c0.company_idx} -> {c0.email} | companyName={c0.company_name!r}")
        if c_last.company_idx != c0.company_idx:
            print(
                f"Last company                : idx={c_last.company_idx} -> {c_last.email} | "
                f"companyName={c_last.company_name!r}"
            )

    selected_jobs = (
        dataset.jobs[offset:]
        if limit is None
        else dataset.jobs[offset : offset + limit]
    )
    print(f"Selected job slice          : {len(selected_jobs)} row(s) (offset={offset}, limit={limit})")
    if target_status == "ACTIVE" and activate_limit is None and len(selected_jobs) > 1000:
        print(
            "\n[WARNING] Activating all ~15,000 jobs to ACTIVE will include all of them in "
            "student recommendation requests (POST /api/students/me/recommendations/generate), "
            "which may exceed Backend's 15s ai-service read timeout."
        )


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.bulk_job_ingest",
        description=(
            "Resumable bulk Company registration/verification & Job CSV ingestion CLI."
        ),
    )
    parser.add_argument(
        "--csv-path",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"Input job CSV path (default: {DEFAULT_CSV_PATH})",
    )
    parser.add_argument(
        "--skill-catalog-path",
        type=Path,
        default=DEFAULT_SKILL_CATALOG_PATH,
        help=f"Canonical skill catalog JSON (default: {DEFAULT_SKILL_CATALOG_PATH})",
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
        default="job-ingest-default",
        help="Run workspace name under --runs-dir",
    )
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=DEFAULT_RUNS_DIR,
        help=f"Base folder for state/logs/reports (default: {DEFAULT_RUNS_DIR})",
    )
    parser.add_argument(
        "--phase",
        choices=("companies", "jobs", "all"),
        default="all",
        help="Execution phase: companies, jobs, or all (default: all)",
    )
    parser.add_argument(
        "--target-status",
        choices=("ACTIVE", "DRAFT"),
        default="ACTIVE",
        help="Target status for ingested jobs (default: ACTIVE)",
    )
    parser.add_argument(
        "--activate-limit",
        type=int,
        default=None,
        help="Optional cap on how many jobs to transition to ACTIVE (rest created as DRAFT)",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="0-based starting suffix for ptithcm{i:04d}@gmail.com (default: 0)",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Slice offset into manifest items (default: 0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum items to process in this run slice (default: all)",
    )
    parser.add_argument(
        "--company-concurrency",
        type=int,
        default=DEFAULT_COMPANY_CONCURRENCY,
        help=f"Company registration/verification concurrency (default: {DEFAULT_COMPANY_CONCURRENCY})",
    )
    parser.add_argument(
        "--job-concurrency",
        type=int,
        default=DEFAULT_JOB_CONCURRENCY,
        help=f"Job creation/activation concurrency (default: {DEFAULT_JOB_CONCURRENCY})",
    )
    parser.add_argument("--location", default=DEFAULT_LOCATION)
    parser.add_argument(
        "--job-type",
        choices=("FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT"),
        default=DEFAULT_JOB_TYPE,
    )
    parser.add_argument(
        "--working-model",
        choices=("ONSITE", "HYBRID", "REMOTE"),
        default=DEFAULT_WORKING_MODEL,
    )
    parser.add_argument("--benefits", default=None)
    parser.add_argument("--salary-min", type=float, default=None)
    parser.add_argument("--salary-max", type=float, default=None)
    parser.add_argument("--currency", default=None)
    parser.add_argument("--deadline", default=None, help="ISO date YYYY-MM-DD")
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

    dataset = load_job_csv(args.csv_path, start_index=args.start_index)
    if dataset.stats.valid_job_rows == 0:
        print(f"No valid job rows found in CSV: {args.csv_path}")
        return 1

    matcher = CanonicalSkillMatcher.from_catalog_file(args.skill_catalog_path)
    run_dir = Path(args.runs_dir) / args.run_name
    db_path = run_dir / "state.sqlite"

    if args.dry_run:
        if db_path.exists():
            with JobIngestStateStore(db_path) as store:
                manifest_state = store.initialize_or_verify_manifest(
                    dataset,
                    matcher=matcher,
                    default_target_status=args.target_status,
                    activate_limit=args.activate_limit,
                    read_only_verify=True,
                )
        else:
            manifest_state = "dry_run_new"
        _print_dry_run_report(
            dataset,
            manifest_state=manifest_state,
            offset=args.offset,
            limit=args.limit,
            target_status=args.target_status,
            activate_limit=args.activate_limit,
        )
        return 0

    started = time.perf_counter()
    logger = _build_logger(run_dir, write_file_log=True)
    defaults = SharedJobDefaults(
        location=args.location,
        job_type=args.job_type,
        working_model=args.working_model,
        benefits=args.benefits,
        salary_min=args.salary_min,
        salary_max=args.salary_max,
        currency=args.currency,
        deadline=args.deadline,
    )

    total_retryable = 0
    total_permanent = 0

    with JobIngestStateStore(db_path) as store:
        manifest_state = store.initialize_or_verify_manifest(
            dataset,
            matcher=matcher,
            default_target_status=args.target_status,
            activate_limit=args.activate_limit,
            read_only_verify=False,
        )
        logger.info(
            "run=%s manifest=%s companies=%d jobs=%d phase=%s target=%s",
            args.run_name,
            manifest_state,
            dataset.stats.unique_companies,
            dataset.stats.valid_job_rows,
            args.phase,
            args.target_status,
        )

        max_conc = max(args.company_concurrency, args.job_concurrency)
        with BackendJobIngestClient(
            args.base_url,
            admin_email=args.admin_email,
            admin_password=args.admin_password,
            max_concurrency=max_conc,
            timeout_seconds=args.timeout,
            max_retries=args.max_retries,
        ) as client:
            client.check_health()
            admin_token = client.get_admin_token()

            if args.phase in ("companies", "all"):
                # In phase=all with --limit N jobs, ensure companies needed by those jobs (or limit companies when phase=companies)
                if args.phase == "companies":
                    selected_companies = store.select_companies(
                        retry_failed_only=args.retry_failed,
                        offset=args.offset,
                        limit=args.limit,
                    )
                else:
                    if args.limit is not None:
                        target_jobs_preview = store.select_jobs(
                            retry_failed_only=args.retry_failed,
                            offset=args.offset,
                            limit=args.limit,
                        )
                        needed_company_idxs = {
                            j.company_idx for j in target_jobs_preview
                        }
                        selected_companies = [
                            c
                            for c in store.select_companies(
                                retry_failed_only=args.retry_failed
                            )
                            if c.company_idx in needed_company_idxs
                        ]
                    else:
                        selected_companies = store.select_companies(
                            retry_failed_only=args.retry_failed
                        )

                comp_outcome = run_company_phase(
                    companies=selected_companies,
                    client=client,
                    store=store,
                    concurrency=args.company_concurrency,
                    logger=logger,
                )
                total_retryable += comp_outcome.failed_retryable
                total_permanent += comp_outcome.failed_permanent

            if args.phase in ("jobs", "all"):
                skill_id_map = sync_catalog_skills(
                    client,
                    admin_token=admin_token,
                    matcher=matcher,
                )
                logger.info(
                    "synced_canonical_skills=%d", len(skill_id_map)
                )
                selected_jobs = store.select_jobs(
                    retry_failed_only=args.retry_failed,
                    offset=args.offset,
                    limit=args.limit,
                )
                job_outcome = run_job_phase(
                    jobs=selected_jobs,
                    client=client,
                    store=store,
                    defaults=defaults,
                    skill_id_map=skill_id_map,
                    concurrency=args.job_concurrency,
                    logger=logger,
                )
                total_retryable += job_outcome.failed_retryable
                total_permanent += job_outcome.failed_permanent

        elapsed = time.perf_counter() - started
        summary_path, failures_path, _ = store.export_reports(
            run_dir, elapsed_seconds=elapsed
        )
        logger.info(
            "finished elapsed=%.2fs retryable=%d permanent=%d summary=%s failures=%s",
            elapsed,
            total_retryable,
            total_permanent,
            summary_path,
            failures_path,
        )

    return 0 if (total_retryable == 0 and total_permanent == 0) else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
