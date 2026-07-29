"""Strict loading and validation for offline evaluation datasets."""

from __future__ import annotations

import csv
from dataclasses import dataclass
import json
from pathlib import Path
import re
from types import MappingProxyType
from typing import Mapping, TypeVar


_DOCUMENT_KEYS = frozenset({"id", "text", "skills"})
_JUDGMENT_HEADER = ["cv_id", "job_id", "relevance"]
_CSV_INTEGER_PATTERN = re.compile(r"[0-9]+")
_MAX_JOB_COUNT = 100


class DatasetValidationError(ValueError):
    """Raised when an evaluation dataset violates its checked contract."""


@dataclass(frozen=True, slots=True)
class CvRecord:
    id: int
    text: str
    skills: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class JobRecord:
    id: int
    text: str
    skills: tuple[str, ...]


DocumentRecord = TypeVar("DocumentRecord", CvRecord, JobRecord)


@dataclass(frozen=True, slots=True)
class Judgment:
    cv_id: int
    job_id: int
    relevance: int


@dataclass(frozen=True, slots=True)
class EvaluationDataset:
    name: str
    cvs: tuple[CvRecord, ...]
    jobs: tuple[JobRecord, ...]
    judgments: Mapping[tuple[int, int], int]

    @property
    def judgment_count(self) -> int:
        return len(self.judgments)

    def relevance_for(self, cv_id: int, job_id: int) -> int:
        return self.judgments[(cv_id, job_id)]


def load_dataset(dataset_directory: str | Path) -> EvaluationDataset:
    """Load one complete, human-labeled evaluation dataset."""

    directory = Path(dataset_directory)
    if not directory.is_dir():
        raise DatasetValidationError(
            f"dataset directory does not exist: {directory}"
        )

    cvs = _load_documents(
        directory / "cvs.json",
        record_type=CvRecord,
        label="CV",
    )
    jobs = _load_documents(
        directory / "jobs.json",
        record_type=JobRecord,
        label="Job",
    )
    if len(jobs) > _MAX_JOB_COUNT:
        raise DatasetValidationError(
            f"jobs.json: at most {_MAX_JOB_COUNT} Jobs are allowed; "
            f"found {len(jobs)}"
        )

    judgments = _load_judgments(directory / "judgments.csv")
    _validate_judgments(cvs, jobs, judgments)
    judgment_map = {
        (judgment.cv_id, judgment.job_id): judgment.relevance
        for judgment in judgments
    }
    return EvaluationDataset(
        name=directory.name,
        cvs=tuple(sorted(cvs, key=lambda cv: cv.id)),
        jobs=tuple(sorted(jobs, key=lambda job: job.id)),
        judgments=MappingProxyType(dict(sorted(judgment_map.items()))),
    )


def _load_documents(
    path: Path,
    *,
    record_type: type[DocumentRecord],
    label: str,
) -> list[DocumentRecord]:
    document = _read_json(path)
    if type(document) is not list:
        raise DatasetValidationError(
            f"{path.name}: root must be a JSON array"
        )
    if not document:
        raise DatasetValidationError(
            f"{path.name}: dataset must contain at least one {label}"
        )

    records: list[DocumentRecord] = []
    seen_ids: set[int] = set()
    for index, value in enumerate(document):
        item_path = f"{path.name}[{index}]"
        if type(value) is not dict:
            raise DatasetValidationError(
                f"{item_path}: expected an object"
            )
        actual_keys = set(value)
        missing_keys = sorted(_DOCUMENT_KEYS - actual_keys)
        unknown_keys = sorted(actual_keys - _DOCUMENT_KEYS)
        if missing_keys:
            raise DatasetValidationError(
                f"{item_path}: missing field {missing_keys[0]!r}"
            )
        if unknown_keys:
            raise DatasetValidationError(
                f"{item_path}: unknown field {unknown_keys[0]!r}"
            )

        record_id = _require_positive_json_id(
            value["id"],
            f"{item_path}.id",
        )
        if record_id in seen_ids:
            raise DatasetValidationError(
                f"{path.name}: duplicate {label} ID {record_id}"
            )
        seen_ids.add(record_id)

        text = value["text"]
        if type(text) is not str or not text.strip():
            raise DatasetValidationError(
                f"{item_path}.text: expected a non-blank string"
            )

        skills_value = value["skills"]
        if type(skills_value) is not list:
            raise DatasetValidationError(
                f"{item_path}.skills: expected an array"
            )
        skills: list[str] = []
        for skill_index, skill in enumerate(skills_value):
            if type(skill) is not str or not skill.strip():
                raise DatasetValidationError(
                    f"{item_path}.skills[{skill_index}]: "
                    "expected a non-blank string"
                )
            skills.append(skill)

        records.append(
            record_type(
                id=record_id,
                text=text,
                skills=tuple(skills),
            )
        )
    return records


def _read_json(path: Path) -> object:
    try:
        source = path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise DatasetValidationError(
            f"required dataset file is missing: {path.name}"
        ) from error
    except (OSError, UnicodeError) as error:
        raise DatasetValidationError(
            f"{path.name}: cannot be read as UTF-8: {error}"
        ) from error

    try:
        return json.loads(
            source,
            object_pairs_hook=_reject_duplicate_json_keys,
            parse_constant=_reject_non_json_constant,
        )
    except json.JSONDecodeError as error:
        raise DatasetValidationError(
            f"{path.name}: malformed JSON at line {error.lineno}, "
            f"column {error.colno}: {error.msg}"
        ) from error
    except ValueError as error:
        raise DatasetValidationError(
            f"{path.name}: malformed JSON: {error}"
        ) from error


def _reject_duplicate_json_keys(
    pairs: list[tuple[str, object]],
) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate object key {key!r}")
        result[key] = value
    return result


def _reject_non_json_constant(value: str) -> object:
    raise ValueError(f"non-standard numeric constant {value!r}")


def _require_positive_json_id(value: object, path: str) -> int:
    if type(value) is not int or value <= 0:
        raise DatasetValidationError(
            f"{path}: expected a positive integer"
        )
    return value


def _load_judgments(path: Path) -> list[Judgment]:
    try:
        stream = path.open("r", encoding="utf-8", newline="")
    except FileNotFoundError as error:
        raise DatasetValidationError(
            f"required dataset file is missing: {path.name}"
        ) from error
    except (OSError, UnicodeError) as error:
        raise DatasetValidationError(
            f"{path.name}: cannot be read as UTF-8: {error}"
        ) from error

    try:
        with stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != _JUDGMENT_HEADER:
                raise DatasetValidationError(
                    f"{path.name}: header must be exactly "
                    "cv_id,job_id,relevance"
                )

            judgments: list[Judgment] = []
            seen_pairs: set[tuple[int, int]] = set()
            for line_number, row in enumerate(reader, start=2):
                if None in row or any(value is None for value in row.values()):
                    raise DatasetValidationError(
                        f"{path.name}:{line_number}: expected exactly "
                        "3 columns"
                    )
                cv_id = _parse_positive_csv_id(
                    row["cv_id"],
                    f"{path.name}:{line_number}: cv_id",
                )
                job_id = _parse_positive_csv_id(
                    row["job_id"],
                    f"{path.name}:{line_number}: job_id",
                )
                relevance_value = row["relevance"]
                if relevance_value not in {"0", "1", "2"}:
                    raise DatasetValidationError(
                        f"{path.name}:{line_number}: relevance must be "
                        "0, 1, or 2"
                    )
                pair = (cv_id, job_id)
                if pair in seen_pairs:
                    raise DatasetValidationError(
                        f"{path.name}:{line_number}: duplicate judgment "
                        f"for cv_id={cv_id}, job_id={job_id}"
                    )
                seen_pairs.add(pair)
                judgments.append(
                    Judgment(
                        cv_id=cv_id,
                        job_id=job_id,
                        relevance=int(relevance_value),
                    )
                )
            return judgments
    except csv.Error as error:
        raise DatasetValidationError(
            f"{path.name}: malformed CSV: {error}"
        ) from error


def _parse_positive_csv_id(value: str, path: str) -> int:
    if not _CSV_INTEGER_PATTERN.fullmatch(value):
        raise DatasetValidationError(
            f"{path}: expected a positive integer"
        )
    parsed = int(value)
    if parsed <= 0:
        raise DatasetValidationError(
            f"{path}: expected a positive integer"
        )
    return parsed


def _validate_judgments(
    cvs: list[CvRecord],
    jobs: list[JobRecord],
    judgments: list[Judgment],
) -> None:
    cv_ids = {cv.id for cv in cvs}
    job_ids = {job.id for job in jobs}
    for judgment in judgments:
        if judgment.cv_id not in cv_ids:
            raise DatasetValidationError(
                "judgments.csv: judgment references unknown "
                f"cv_id={judgment.cv_id}"
            )
        if judgment.job_id not in job_ids:
            raise DatasetValidationError(
                "judgments.csv: judgment references unknown "
                f"job_id={judgment.job_id}"
            )

    actual_pairs = {
        (judgment.cv_id, judgment.job_id)
        for judgment in judgments
    }
    expected_pairs = {
        (cv_id, job_id)
        for cv_id in cv_ids
        for job_id in job_ids
    }
    missing_pairs = sorted(expected_pairs - actual_pairs)
    if missing_pairs:
        cv_id, job_id = missing_pairs[0]
        raise DatasetValidationError(
            "judgments.csv: missing judgment for "
            f"cv_id={cv_id}, job_id={job_id}"
        )

    relevance_by_cv = {cv_id: 0 for cv_id in cv_ids}
    for judgment in judgments:
        if judgment.relevance >= 1:
            relevance_by_cv[judgment.cv_id] += 1
    for cv_id in sorted(relevance_by_cv):
        if relevance_by_cv[cv_id] == 0:
            raise DatasetValidationError(
                f"judgments.csv: cv_id={cv_id} must have at least "
                "one Job with relevance greater than 0"
            )
