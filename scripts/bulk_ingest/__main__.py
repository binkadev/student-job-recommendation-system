"""CLI entrypoint for safe, resumable Student registration + CV PDF bulk upload."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
import sys
from typing import Sequence

from . import (
    DEFAULT_BASE_URL,
    DEFAULT_CONCURRENCY,
    DEFAULT_INPUT_DIR,
    DEFAULT_MAX_RETRIES,
    DEFAULT_RUNS_DIR,
    DEFAULT_TIMEOUT_SECONDS,
)
from .client import BackendIngestClient
from .scanner import ScanSummary, scan_pdf_directory
from .state_store import IngestStateStore
from .worker import run_ingestion


def _configure_utf8_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _build_logger(run_dir: Path, *, write_file_log: bool) -> logging.Logger:
    logger = logging.getLogger("bulk_ingest")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    if write_file_log:
        run_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(
            run_dir / "run.log",
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Silence verbose per-request httpx/httpcore logs so JWTs/headers stay clean.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    return logger


def _format_bytes(num_bytes: int) -> str:
    mib = num_bytes / (1024 * 1024)
    if mib >= 1024:
        return f"{mib / 1024:.2f} GiB ({num_bytes:,} bytes)"
    return f"{mib:.2f} MiB ({num_bytes:,} bytes)"


def _print_dry_run_report(
    scan: ScanSummary,
    *,
    manifest_state: str,
    offset: int,
    limit: int | None,
) -> None:
    print("=== Bulk CV Ingestion Dry Run (No HTTP Calls Executed) ===")
    print(f"Manifest check : {manifest_state}")
    print(f"Total PDFs     : {scan.total_files}")
    print(f"Valid PDFs     : {scan.valid_files}")
    print(f"Invalid PDFs   : {scan.invalid_files}")
    print(f"Disk footprint : {_format_bytes(scan.total_bytes)}")

    items = scan.items
    selected = items[offset:] if limit is None else items[offset : offset + limit]
    print(f"Selected slice : {len(selected)} item(s) (offset={offset}, limit={limit})")
    if selected:
        first = selected[0]
        last = selected[-1]
        print(
            f"First mapping  : idx={first.idx} -> {first.email} | "
            f"fullName={first.full_name} | file={first.rel_path}"
        )
        if last.idx != first.idx:
            print(
                f"Last mapping   : idx={last.idx} -> {last.email} | "
                f"fullName={last.full_name} | file={last.rel_path}"
            )

    invalid_items = [item for item in items if not item.is_valid]
    if invalid_items:
        print("\nInvalid PDF files detected (would be marked FAILED_PERMANENT):")
        for bad in invalid_items[:20]:
            print(f"  - idx={bad.idx} file={bad.rel_path} reason={bad.validation_error}")
        if len(invalid_items) > 20:
            print(f"  ... and {len(invalid_items) - 20} more invalid files.")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.bulk_ingest",
        description=(
            "Resumable bulk Student account registration & CV PDF upload tool "
            "(Register + Upload only; AI analysis intentionally deferred)."
        ),
    )
    parser.add_argument(
        "--input-dir",
        action="append",
        dest="input_dirs",
        type=Path,
        default=None,
        help=(
            "Directory containing CV PDF files (repeatable). "
            f"Defaults to: {DEFAULT_INPUT_DIR}"
        ),
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Backend base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--run-name",
        default="cv-ingest-default",
        help="Run workspace name under --runs-dir for state.sqlite & reports",
    )
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=DEFAULT_RUNS_DIR,
        help=f"Base folder for run state/logs (default: {DEFAULT_RUNS_DIR})",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="0-based starting suffix index for n22dccn{i:04d}@gmail.com (default: 0)",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Slice offset into sorted manifest items (default: 0)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum manifest items in this slice (default: all)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help=f"Concurrent HTTP workers for register+upload (default: {DEFAULT_CONCURRENCY})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"HTTP request timeout in seconds (default: {DEFAULT_TIMEOUT_SECONDS})",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=DEFAULT_MAX_RETRIES,
        help=f"Max retries for transient network/5xx errors (default: {DEFAULT_MAX_RETRIES})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate PDF files and preview index mapping without calling APIs",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Process only items currently in FAILED_RETRYABLE state",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    _configure_utf8_console()
    args = parse_args(argv)

    input_dirs = args.input_dirs if args.input_dirs else [DEFAULT_INPUT_DIR]
    run_dir = Path(args.runs_dir) / args.run_name
    db_path = run_dir / "state.sqlite"

    scan = scan_pdf_directory(input_dirs, start_index=args.start_index)
    if scan.total_files == 0:
        print(f"No .pdf files found in: {[str(d) for d in input_dirs]}")
        return 1

    if args.dry_run:
        if db_path.exists():
            with IngestStateStore(db_path) as store:
                manifest_state = store.initialize_or_verify_manifest(
                    scan.items,
                    read_only_verify=True,
                )
        else:
            manifest_state = "dry_run_new"
        _print_dry_run_report(
            scan,
            manifest_state=manifest_state,
            offset=args.offset,
            limit=args.limit,
        )
        return 0

    logger = _build_logger(run_dir, write_file_log=True)
    with IngestStateStore(db_path) as store:
        manifest_state = store.initialize_or_verify_manifest(
            scan.items,
            read_only_verify=False,
        )
        items = store.select_items(
            retry_failed_only=args.retry_failed,
            offset=args.offset,
            limit=args.limit,
        )
        logger.info(
            "run=%s manifest=%s total_scanned=%d selected_pending=%d concurrency=%d base_url=%s",
            args.run_name,
            manifest_state,
            scan.total_files,
            len(items),
            args.concurrency,
            args.base_url,
        )

        with BackendIngestClient(
            args.base_url,
            concurrency=args.concurrency,
            timeout_seconds=args.timeout,
            max_retries=args.max_retries,
        ) as client:
            client.check_health()
            outcome = run_ingestion(
                items=items,
                client=client,
                store=store,
                run_dir=run_dir,
                concurrency=args.concurrency,
                logger=logger,
            )

    logger.info(
        "completed processed=%d uploaded=%d retryable=%d permanent=%d elapsed=%.2fs summary=%s failures=%s",
        outcome.processed,
        outcome.succeeded,
        outcome.failed_retryable,
        outcome.failed_permanent,
        outcome.elapsed_seconds,
        outcome.summary_path,
        outcome.failures_path,
    )
    return 0 if (outcome.failed_retryable == 0 and outcome.failed_permanent == 0) else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
