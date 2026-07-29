"""Contract tests for human-labeled offline evaluation datasets."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from evaluation.dataset import DatasetValidationError, load_dataset


DEFAULT_CVS = [
    {
        "id": 1,
        "text": "Java backend engineer with API development experience.",
        "skills": ["Java", "Spring Boot"],
    }
]
DEFAULT_JOBS = [
    {
        "id": 101,
        "text": "Java backend role building reliable REST APIs.",
        "skills": ["Java"],
    }
]
DEFAULT_JUDGMENTS = "cv_id,job_id,relevance\n1,101,2\n"


def _write_dataset(
    directory: Path,
    *,
    cvs: object = DEFAULT_CVS,
    jobs: object = DEFAULT_JOBS,
    judgments: str = DEFAULT_JUDGMENTS,
) -> Path:
    directory.mkdir()
    (directory / "cvs.json").write_text(
        json.dumps(cvs),
        encoding="utf-8",
    )
    (directory / "jobs.json").write_text(
        json.dumps(jobs),
        encoding="utf-8",
    )
    (directory / "judgments.csv").write_text(
        judgments,
        encoding="utf-8",
    )
    return directory


def test_loads_valid_complete_dataset_deterministically(tmp_path: Path) -> None:
    directory = _write_dataset(tmp_path / "pilot")

    first = load_dataset(directory)
    second = load_dataset(directory)

    assert first == second
    assert first.name == "pilot"
    assert first.cvs[0].id == 1
    assert first.jobs[0].id == 101
    assert first.relevance_for(1, 101) == 2
    assert first.judgment_count == 1


@pytest.mark.parametrize(
    ("file_name", "message"),
    [
        ("cvs.json", "required dataset file is missing: cvs.json"),
        ("jobs.json", "required dataset file is missing: jobs.json"),
        (
            "judgments.csv",
            "required dataset file is missing: judgments.csv",
        ),
    ],
)
def test_rejects_missing_files(
    tmp_path: Path,
    file_name: str,
    message: str,
) -> None:
    directory = _write_dataset(tmp_path / "dataset")
    (directory / file_name).unlink()

    with pytest.raises(DatasetValidationError, match=message):
        load_dataset(directory)


@pytest.mark.parametrize(
    ("cvs", "jobs", "message"),
    [
        ({"id": 1}, DEFAULT_JOBS, "root must be a JSON array"),
        (
            [{"id": 1, "text": "CV", "skills": [], "extra": True}],
            DEFAULT_JOBS,
            "unknown field 'extra'",
        ),
        (
            [{"id": "1", "text": "CV", "skills": []}],
            DEFAULT_JOBS,
            "expected a positive integer",
        ),
        (
            [{"id": 0, "text": "CV", "skills": []}],
            DEFAULT_JOBS,
            "expected a positive integer",
        ),
        (
            [
                {"id": 1, "text": "CV one", "skills": []},
                {"id": 1, "text": "CV two", "skills": []},
            ],
            DEFAULT_JOBS,
            "duplicate CV ID 1",
        ),
        (
            DEFAULT_CVS,
            [
                {"id": 101, "text": "Job one", "skills": []},
                {"id": 101, "text": "Job two", "skills": []},
            ],
            "duplicate Job ID 101",
        ),
        (
            [{"id": 1, "text": "   ", "skills": []}],
            DEFAULT_JOBS,
            "expected a non-blank string",
        ),
        (
            [{"id": 1, "text": "CV", "skills": [""]}],
            DEFAULT_JOBS,
            "skills\\[0\\].*non-blank string",
        ),
        (
            [{"id": 1, "text": "CV", "skills": [3]}],
            DEFAULT_JOBS,
            "skills\\[0\\].*non-blank string",
        ),
        ([], DEFAULT_JOBS, "at least one CV"),
        (DEFAULT_CVS, [], "at least one Job"),
    ],
)
def test_rejects_invalid_json_document_contract(
    tmp_path: Path,
    cvs: object,
    jobs: object,
    message: str,
) -> None:
    directory = _write_dataset(
        tmp_path / "dataset",
        cvs=cvs,
        jobs=jobs,
    )

    with pytest.raises(DatasetValidationError, match=message):
        load_dataset(directory)


def test_rejects_malformed_json_and_csv_schema(tmp_path: Path) -> None:
    malformed_json = _write_dataset(tmp_path / "json")
    (malformed_json / "cvs.json").write_text("{", encoding="utf-8")
    with pytest.raises(DatasetValidationError, match="malformed JSON"):
        load_dataset(malformed_json)

    malformed_csv = _write_dataset(
        tmp_path / "csv",
        judgments="job_id,cv_id,relevance\n101,1,2\n",
    )
    with pytest.raises(DatasetValidationError, match="header must be exactly"):
        load_dataset(malformed_csv)


@pytest.mark.parametrize(
    ("judgments", "message"),
    [
        (
            "cv_id,job_id,relevance\n2,101,1\n",
            "unknown cv_id=2",
        ),
        (
            "cv_id,job_id,relevance\n1,999,1\n",
            "unknown job_id=999",
        ),
        (
            "cv_id,job_id,relevance\n1,101,1\n1,101,2\n",
            "duplicate judgment",
        ),
        (
            "cv_id,job_id,relevance\n1,101,3\n",
            "relevance must be 0, 1, or 2",
        ),
        (
            "cv_id,job_id,relevance\n1,101,0\n",
            "must have at least one Job",
        ),
    ],
)
def test_rejects_invalid_judgments(
    tmp_path: Path,
    judgments: str,
    message: str,
) -> None:
    directory = _write_dataset(
        tmp_path / "dataset",
        judgments=judgments,
    )

    with pytest.raises(DatasetValidationError, match=message):
        load_dataset(directory)


def test_rejects_missing_cartesian_pair(tmp_path: Path) -> None:
    jobs = [
        DEFAULT_JOBS[0],
        {"id": 102, "text": "Second Job", "skills": []},
    ]
    directory = _write_dataset(
        tmp_path / "dataset",
        jobs=jobs,
        judgments=DEFAULT_JUDGMENTS,
    )

    with pytest.raises(
        DatasetValidationError,
        match="missing judgment for cv_id=1, job_id=102",
    ):
        load_dataset(directory)


def test_rejects_more_than_one_hundred_jobs(tmp_path: Path) -> None:
    jobs = [
        {"id": index, "text": f"Job {index}", "skills": []}
        for index in range(1, 102)
    ]
    directory = _write_dataset(tmp_path / "dataset", jobs=jobs)

    with pytest.raises(DatasetValidationError, match="at most 100 Jobs"):
        load_dataset(directory)
