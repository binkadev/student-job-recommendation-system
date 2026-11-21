"""Streaming CSV loader, company grouping, and length/blank validation."""

from __future__ import annotations

import csv
from dataclasses import dataclass
import hashlib
from pathlib import Path
import sys

from . import (
    MAX_LONG_TEXT_LENGTH,
    MAX_TITLE_AND_COMPANY_NAME_LENGTH,
    format_company_identity,
)

# Raise CSV field size limit safely to handle oversized raw job texts before truncation.
try:
    csv.field_size_limit(min(sys.maxsize, 16_777_216))
except OverflowError:
    csv.field_size_limit(16_777_216)

_ENCODINGS = ("utf-8-sig", "utf-8", "cp1252")


@dataclass(frozen=True, slots=True)
class GroupedCompany:
    """One unique Company derived from grouped normalized job `name`."""

    company_idx: int
    group_key: str
    company_name: str
    email: str
    full_name: str


@dataclass(frozen=True, slots=True)
class ParsedJobRow:
    """One validated, bounded CSV job row linked to its grouped Company."""

    job_row_idx: int
    csv_line_number: int
    company_idx: int
    group_key: str
    title: str
    description: str
    requirements: str | None
    row_sha256: str


@dataclass(frozen=True, slots=True)
class CsvLoadStats:
    """Preflight inventory metrics over the input CSV."""

    total_csv_rows: int
    valid_job_rows: int
    unique_companies: int
    blank_name_skipped: int
    blank_description_skipped: int
    truncated_name_count: int
    truncated_description_count: int
    truncated_requirements_count: int
    encoding_used: str


@dataclass(frozen=True, slots=True)
class CsvDataset:
    """Complete deterministic Company + Job dataset loaded from CSV."""

    companies: tuple[GroupedCompany, ...]
    jobs: tuple[ParsedJobRow, ...]
    stats: CsvLoadStats


def _collapse_whitespace(text: str) -> str:
    return " ".join(text.split())


def _truncate_text(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    truncated = text[:limit].rstrip()
    return truncated, True


def _compute_row_sha256(
    *,
    group_key: str,
    title: str,
    description: str,
    requirements: str | None,
) -> str:
    digest = hashlib.sha256()
    digest.update(group_key.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(title.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(description.encode("utf-8"))
    digest.update(b"\x00")
    digest.update((requirements or "").encode("utf-8"))
    return digest.hexdigest()


def _open_csv_with_fallback(
    csv_path: Path,
) -> tuple[list[dict[str, str]], list[str], str]:
    last_decode_error: Exception | None = None
    for encoding in _ENCODINGS:
        try:
            with csv_path.open("r", encoding=encoding, newline="") as handle:
                reader = csv.DictReader(handle)
                if reader.fieldnames is None:
                    raise ValueError(f"CSV file is empty: {csv_path}")
                normalized_headers = [h.strip() for h in reader.fieldnames]
                reader.fieldnames = normalized_headers
                rows: list[dict[str, str]] = []
                for raw_row in reader:
                    rows.append(raw_row)
                return rows, normalized_headers, encoding
        except UnicodeDecodeError as exc:
            last_decode_error = exc
            continue
    raise ValueError(
        f"Unable to decode CSV {csv_path} using {_ENCODINGS}: {last_decode_error}"
    )


def load_job_csv(
    csv_path: Path,
    *,
    start_index: int = 0,
) -> CsvDataset:
    """Load, validate, truncate, and deterministically group job.csv."""
    if start_index < 0:
        raise ValueError(f"start_index must be >= 0, got {start_index}")

    resolved = Path(csv_path).expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"CSV file not found: {resolved}")

    raw_rows, headers, encoding_used = _open_csv_with_fallback(resolved)
    required_columns = {"name", "description", "requirment"}
    missing_columns = required_columns - set(headers)
    if missing_columns:
        raise ValueError(
            f"CSV {resolved} missing required column(s): {sorted(missing_columns)}; "
            f"found={headers}"
        )

    blank_name_skipped = 0
    blank_description_skipped = 0
    truncated_name_count = 0
    truncated_description_count = 0
    truncated_requirements_count = 0

    group_display_names: dict[str, str] = {}
    staged_rows: list[tuple[int, str, str, str, str | None]] = []

    for row_idx_1based, row in enumerate(raw_rows, start=2):
        raw_name = _collapse_whitespace(row.get("name") or "")
        if not raw_name:
            blank_name_skipped += 1
            continue

        title, name_truncated = _truncate_text(
            raw_name, MAX_TITLE_AND_COMPANY_NAME_LENGTH
        )
        if not title:
            blank_name_skipped += 1
            continue
        if name_truncated:
            truncated_name_count += 1

        raw_desc = (row.get("description") or "").strip()
        if not raw_desc:
            blank_description_skipped += 1
            continue
        description, desc_truncated = _truncate_text(
            raw_desc, MAX_LONG_TEXT_LENGTH
        )
        if not description:
            blank_description_skipped += 1
            continue
        if desc_truncated:
            truncated_description_count += 1

        raw_req = (row.get("requirment") or "").strip()
        requirements: str | None = None
        if raw_req:
            truncated_req, req_truncated = _truncate_text(
                raw_req, MAX_LONG_TEXT_LENGTH
            )
            if req_truncated:
                truncated_requirements_count += 1
            requirements = truncated_req or None

        group_key = title.casefold()
        group_display_names.setdefault(group_key, title)
        staged_rows.append(
            (row_idx_1based, group_key, title, description, requirements)
        )

    sorted_keys = sorted(
        group_display_names.keys(),
        key=lambda key: (key, group_display_names[key]),
    )
    key_to_company_idx: dict[str, int] = {}
    companies: list[GroupedCompany] = []
    for offset, key in enumerate(sorted_keys):
        company_idx = start_index + offset
        email, full_name = format_company_identity(company_idx)
        key_to_company_idx[key] = company_idx
        companies.append(
            GroupedCompany(
                company_idx=company_idx,
                group_key=key,
                company_name=group_display_names[key],
                email=email,
                full_name=full_name,
            )
        )

    jobs: list[ParsedJobRow] = []
    for job_row_idx, (csv_line, group_key, title, description, requirements) in enumerate(
        staged_rows
    ):
        row_sha = _compute_row_sha256(
            group_key=group_key,
            title=title,
            description=description,
            requirements=requirements,
        )
        jobs.append(
            ParsedJobRow(
                job_row_idx=job_row_idx,
                csv_line_number=csv_line,
                company_idx=key_to_company_idx[group_key],
                group_key=group_key,
                title=title,
                description=description,
                requirements=requirements,
                row_sha256=row_sha,
            )
        )

    return CsvDataset(
        companies=tuple(companies),
        jobs=tuple(jobs),
        stats=CsvLoadStats(
            total_csv_rows=len(raw_rows),
            valid_job_rows=len(jobs),
            unique_companies=len(companies),
            blank_name_skipped=blank_name_skipped,
            blank_description_skipped=blank_description_skipped,
            truncated_name_count=truncated_name_count,
            truncated_description_count=truncated_description_count,
            truncated_requirements_count=truncated_requirements_count,
            encoding_used=encoding_used,
        ),
    )
