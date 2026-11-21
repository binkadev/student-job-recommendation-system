"""Concurrent resumable worker for Student registration + CV PDF upload."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import logging
from pathlib import Path
import time

from . import DEFAULT_PASSWORD
from .client import (
    BackendIngestClient,
    EmailAlreadyExistsError,
    IngestApiError,
    UnauthorizedSessionError,
)
from .scanner import inspect_pdf_file
from .state_store import (
    STATUS_PENDING,
    STATUS_REGISTERED,
    IngestStateStore,
    ManifestItem,
)


@dataclass(frozen=True, slots=True)
class RunOutcome:
    """Aggregate result returned by run_ingestion."""

    processed: int
    succeeded: int
    failed_retryable: int
    failed_permanent: int
    elapsed_seconds: float
    summary_path: Path
    failures_path: Path
    status_counts: dict[str, int]


def _match_existing_cv_id(
    client: BackendIngestClient,
    *,
    token: str,
    item: ManifestItem,
) -> int | None:
    existing = client.list_my_cvs(token=token)
    for record in existing:
        if (
            record.original_file_name == item.sanitized_name
            and (record.file_size is None or record.file_size == item.file_size)
        ):
            return record.cv_id
    return None


def process_single_item(
    item: ManifestItem,
    *,
    client: BackendIngestClient,
    store: IngestStateStore,
    logger: logging.Logger,
    password: str = DEFAULT_PASSWORD,
) -> str:
    """Execute idempotent register -> login -> CV check/upload for one manifest item."""
    attempts = item.attempts + 1
    user_id = item.user_id

    # Re-verify source file before upload in case disk file disappeared after scan.
    file_path = Path(item.abs_path)
    actual_size, actual_sha256, validation_error = inspect_pdf_file(file_path)
    if validation_error is not None:
        store.mark_failed(
            item.idx,
            retryable=False,
            attempts=attempts,
            http_status=None,
            error_code="SOURCE_PDF_INVALID",
            error_msg=validation_error,
            user_id=user_id,
        )
        return "FAILED_PERMANENT"
    if actual_size != item.file_size or (item.sha256 and actual_sha256 != item.sha256):
        store.mark_failed(
            item.idx,
            retryable=False,
            attempts=attempts,
            http_status=None,
            error_code="SOURCE_PDF_CHANGED",
            error_msg="PDF file changed on disk since manifest creation",
            user_id=user_id,
        )
        return "FAILED_PERMANENT"

    recovered_existing_account = item.status != STATUS_PENDING
    try:
        # 1. Register Student account (if not already registered)
        if item.status in (STATUS_PENDING, "FAILED_RETRYABLE"):
            if user_id is None and item.status != STATUS_REGISTERED:
                try:
                    user_id = client.register_student(
                        email=item.email,
                        password=password,
                        full_name=item.full_name,
                    )
                    store.mark_registered(item.idx, user_id=user_id)
                except EmailAlreadyExistsError:
                    recovered_existing_account = True
                    store.mark_registered(item.idx, user_id=user_id)

        # 2. Login to acquire JWT
        token, login_user_id = client.login(email=item.email, password=password)
        if login_user_id is not None:
            user_id = login_user_id

        # 3. Idempotent recovery check before uploading CV
        cv_id: int | None = None
        if recovered_existing_account or item.status in (STATUS_REGISTERED, "FAILED_RETRYABLE"):
            try:
                cv_id = _match_existing_cv_id(client, token=token, item=item)
            except UnauthorizedSessionError:
                token, _ = client.login(email=item.email, password=password)
                cv_id = _match_existing_cv_id(client, token=token, item=item)

        # 4. Upload PDF (active=true), leaving analysis_status=NOT_READY
        if cv_id is None:
            try:
                cv_id = client.upload_cv(
                    token=token,
                    file_path=file_path,
                    upload_filename=item.sanitized_name,
                )
            except UnauthorizedSessionError:
                token, _ = client.login(email=item.email, password=password)
                cv_id = client.upload_cv(
                    token=token,
                    file_path=file_path,
                    upload_filename=item.sanitized_name,
                )

        store.mark_cv_uploaded(
            item.idx,
            user_id=user_id,
            cv_id=cv_id,
            attempts=attempts,
        )
        return "CV_UPLOADED"

    except IngestApiError as exc:
        store.mark_failed(
            item.idx,
            retryable=exc.retryable,
            attempts=attempts,
            http_status=exc.http_status,
            error_code=exc.error_code,
            error_msg=exc.message,
            user_id=user_id,
        )
        logger.warning(
            "idx=%s email=%s failed retryable=%s code=%s http=%s msg=%s",
            item.idx,
            item.email,
            exc.retryable,
            exc.error_code,
            exc.http_status,
            exc.message,
        )
        return "FAILED_RETRYABLE" if exc.retryable else "FAILED_PERMANENT"
    except Exception as exc:
        store.mark_failed(
            item.idx,
            retryable=True,
            attempts=attempts,
            http_status=None,
            error_code=type(exc).__name__,
            error_msg=str(exc),
            user_id=user_id,
        )
        logger.warning(
            "idx=%s email=%s unexpected failure type=%s msg=%s",
            item.idx,
            item.email,
            type(exc).__name__,
            exc,
        )
        return "FAILED_RETRYABLE"


def run_ingestion(
    *,
    items: list[ManifestItem],
    client: BackendIngestClient,
    store: IngestStateStore,
    run_dir: Path,
    concurrency: int,
    logger: logging.Logger,
) -> RunOutcome:
    """Process selected manifest items using a bounded thread pool."""
    started = time.perf_counter()
    succeeded = 0
    failed_retryable = 0
    failed_permanent = 0
    total = len(items)

    if total > 0:
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
            futures = [
                executor.submit(
                    process_single_item,
                    item,
                    client=client,
                    store=store,
                    logger=logger,
                )
                for item in items
            ]
            completed = 0
            for future in as_completed(futures):
                outcome = future.result()
                completed += 1
                if outcome == "CV_UPLOADED":
                    succeeded += 1
                elif outcome == "FAILED_RETRYABLE":
                    failed_retryable += 1
                else:
                    failed_permanent += 1

                if completed % 100 == 0 or completed == total:
                    elapsed_so_far = time.perf_counter() - started
                    rate = completed / elapsed_so_far if elapsed_so_far > 0 else 0.0
                    logger.info(
                        "progress=%d/%d uploaded=%d retryable=%d permanent=%d rate=%.2f/s",
                        completed,
                        total,
                        succeeded,
                        failed_retryable,
                        failed_permanent,
                        rate,
                    )

    elapsed = time.perf_counter() - started
    summary_path, failures_path, summary_payload = store.export_reports(
        run_dir,
        elapsed_seconds=elapsed,
        processed_in_invocation=total,
    )
    counts = summary_payload["statusCounts"]
    assert isinstance(counts, dict)
    return RunOutcome(
        processed=total,
        succeeded=succeeded,
        failed_retryable=failed_retryable,
        failed_permanent=failed_permanent,
        elapsed_seconds=elapsed,
        summary_path=summary_path,
        failures_path=failures_path,
        status_counts={str(k): int(v) for k, v in counts.items()},
    )
