"""Unit tests for job.csv loading, grouping, blank skips, and truncation."""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from scripts.bulk_job_ingest import format_company_identity
from scripts.bulk_job_ingest.csv_loader import load_job_csv


def _write_csv(path: Path, rows: list[dict[str, str]], encoding: str = "utf-8-sig") -> Path:
    with path.open("w", encoding=encoding, newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name", "description", "requirment"])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return path


def test_format_company_identity() -> None:
    assert format_company_identity(0) == ("ptithcm0000@gmail.com", "ptithcm0000")
    assert format_company_identity(12) == ("ptithcm0012@gmail.com", "ptithcm0012")
    assert format_company_identity(10240) == ("ptithcm10240@gmail.com", "ptithcm10240")
    with pytest.raises(ValueError):
        format_company_identity(-1)


def test_grouping_truncation_and_blank_skipping(tmp_path: Path) -> None:
    csv_file = _write_csv(
        tmp_path / "job.csv",
        [
            {"name": "  Backend   Developer  ", "description": "Build APIs.", "requirment": "Java, Spring Boot"},
            {"name": "backend developer", "description": "Microservices role.", "requirment": ""},
            {"name": "AI Engineer", "description": "d" * 10_050, "requirment": "r" * 10_020},
            {"name": "   ", "description": "Missing title skipped", "requirment": "Python"},
            {"name": "Data Analyst", "description": "   ", "requirment": "SQL"},
            {"name": "X" * 260, "description": "Long title truncated", "requirment": "Docker"},
        ],
    )

    dataset = load_job_csv(csv_file, start_index=0)

    assert dataset.stats.total_csv_rows == 6
    assert dataset.stats.valid_job_rows == 4
    assert dataset.stats.unique_companies == 3
    assert dataset.stats.blank_name_skipped == 1
    assert dataset.stats.blank_description_skipped == 1
    assert dataset.stats.truncated_name_count == 1
    assert dataset.stats.truncated_description_count == 1
    assert dataset.stats.truncated_requirements_count == 1

    # Sorted alphabetically by group_key ("ai engineer", "backend developer", "x"*255)
    assert [c.email for c in dataset.companies] == [
        "ptithcm0000@gmail.com",
        "ptithcm0001@gmail.com",
        "ptithcm0002@gmail.com",
    ]
    assert [c.group_key for c in dataset.companies] == [
        "ai engineer",
        "backend developer",
        "x" * 255,
    ]
    assert dataset.jobs[0].company_idx == 1
    assert dataset.jobs[1].company_idx == 1
    assert dataset.jobs[1].requirements is None
    assert len(dataset.jobs[2].description) == 10_000
    assert dataset.jobs[2].requirements is not None and len(dataset.jobs[2].requirements) == 10_000
    assert len(dataset.jobs[3].title) == 255


def test_missing_requirment_column_raises(tmp_path: Path) -> None:
    bad = tmp_path / "bad.csv"
    with bad.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["name", "description", "requirements"])
        writer.writeheader()
        writer.writerow({"name": "Dev", "description": "Code", "requirements": "Java"})

    with pytest.raises(ValueError, match="requirment"):
        load_job_csv(bad)
