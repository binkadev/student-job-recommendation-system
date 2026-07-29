"""Prepare, review, and finalize independent human annotation packets."""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import random
import re
import sys
from types import MappingProxyType
from typing import Mapping, Sequence

from .dataset import (
    CvRecord,
    DatasetValidationError,
    JobRecord,
    SourceDataset,
    load_source_dataset,
)


_PACKET_HEADER = [
    "pair_id",
    "annotator_id",
    "cv_id",
    "job_id",
    "cv_text",
    "cv_skills",
    "job_text",
    "job_skills",
    "relevance",
    "notes",
]
_ADJUDICATION_HEADER = [
    "cv_id",
    "job_id",
    "relevance",
    "requires_adjudication",
]
_POSITIVE_INTEGER_PATTERN = re.compile(r"[1-9][0-9]*")
_RELEVANCE_VALUES = frozenset({"0", "1", "2"})


class AnnotationWorkflowError(ValueError):
    """Raised when annotation workflow inputs are incomplete or modified."""


@dataclass(frozen=True, slots=True)
class AnnotationManifest:
    dataset_name: str
    cv_count: int
    job_count: int
    pair_count_per_annotator: int
    annotator_ids: tuple[str, ...]
    seed: str
    packet_files: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ReviewedPair:
    cv_id: int
    job_id: int
    relevance_by_annotator: Mapping[str, int]

    @property
    def unanimous_relevance(self) -> int | None:
        labels = set(self.relevance_by_annotator.values())
        if len(labels) == 1:
            return next(iter(labels))
        return None


def prepare_annotation_packets(
    dataset_directory: str | Path,
    annotator_ids: Sequence[str],
    output_directory: str | Path,
    *,
    seed: str,
) -> dict[str, object]:
    """Create one independently shuffled annotation packet per annotator."""

    dataset_path = Path(dataset_directory)
    output_path = Path(output_directory)
    _require_distinct_directories(dataset_path, output_path)
    dataset = load_source_dataset(dataset_path)
    annotators = _validate_annotator_ids(annotator_ids)
    if type(seed) is not str or not seed:
        raise AnnotationWorkflowError("seed must be a non-empty string")

    pairs = [
        (cv, job)
        for cv in dataset.cvs
        for job in dataset.jobs
    ]
    output_path.mkdir(parents=True, exist_ok=True)
    packet_files: list[str] = []
    used_orders: set[tuple[tuple[int, int], ...]] = set()
    for annotator_id in annotators:
        ordered_pairs = _shuffle_pairs(pairs, seed, annotator_id)
        pair_order = tuple(
            (cv.id, job.id)
            for cv, job in ordered_pairs
        )
        if len(pair_order) > 1 and pair_order in used_orders:
            ordered_pairs = ordered_pairs[1:] + ordered_pairs[:1]
            pair_order = tuple(
                (cv.id, job.id)
                for cv, job in ordered_pairs
            )
        used_orders.add(pair_order)

        file_name = f"annotations-{annotator_id}.csv"
        _write_annotation_packet(
            output_path / file_name,
            annotator_id,
            ordered_pairs,
        )
        packet_files.append(file_name)

    manifest = {
        "datasetName": dataset.name,
        "cvCount": len(dataset.cvs),
        "jobCount": len(dataset.jobs),
        "pairCountPerAnnotator": len(pairs),
        "annotatorIds": list(annotators),
        "seed": seed,
        "packetFiles": packet_files,
    }
    _write_json(output_path / "manifest.json", manifest)
    return manifest


def review_annotations(
    dataset_directory: str | Path,
    annotations_directory: str | Path,
    output_directory: str | Path,
) -> dict[str, object]:
    """Validate completed packets and write unresolved review worksheets."""

    dataset = load_source_dataset(dataset_directory)
    annotations_path = Path(annotations_directory)
    manifest = _load_manifest(annotations_path / "manifest.json", dataset)
    if len(manifest.annotator_ids) < 2:
        raise AnnotationWorkflowError(
            "review requires at least 2 annotators"
        )

    annotations: dict[str, dict[tuple[int, int], int]] = {}
    for annotator_id, packet_file in zip(
        manifest.annotator_ids,
        manifest.packet_files,
        strict=True,
    ):
        annotations[annotator_id] = _load_completed_packet(
            annotations_path / packet_file,
            annotator_id,
            dataset,
        )

    reviewed_pairs = _combine_annotations(dataset, annotations)
    output_path = Path(output_directory)
    output_path.mkdir(parents=True, exist_ok=True)
    summary = _build_agreement_summary(
        dataset,
        manifest.annotator_ids,
        reviewed_pairs,
    )
    _write_json(output_path / "agreement-summary.json", summary)
    _write_disagreements(
        output_path / "disagreements.csv",
        manifest.annotator_ids,
        reviewed_pairs,
    )
    _write_adjudication(
        output_path / "judgments.adjudication.csv",
        reviewed_pairs,
    )
    return summary


def finalize_judgments(
    dataset_directory: str | Path,
    adjudication_path: str | Path,
    output_path: str | Path,
    *,
    force: bool = False,
) -> Path:
    """Validate manually adjudicated labels and create final judgments.csv."""

    dataset = load_source_dataset(dataset_directory)
    judgments = _load_final_adjudication(
        Path(adjudication_path),
        dataset,
    )
    destination = Path(output_path)
    if destination.exists() and not force:
        raise AnnotationWorkflowError(
            f"output file already exists: {destination}; use --force "
            "to replace it"
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["cv_id", "job_id", "relevance"])
        for (cv_id, job_id), relevance in sorted(judgments.items()):
            writer.writerow([cv_id, job_id, relevance])
    return destination


def pair_id(cv_id: int, job_id: int) -> str:
    """Return the stable, human-readable identifier for one CV–Job pair."""

    return f"cv-{cv_id}-job-{job_id}"


def _require_distinct_directories(dataset: Path, output: Path) -> None:
    if dataset.resolve() == output.resolve():
        raise AnnotationWorkflowError(
            "output directory must differ from the input dataset directory"
        )


def _validate_annotator_ids(
    annotator_ids: Sequence[str],
) -> tuple[str, ...]:
    if not annotator_ids:
        raise AnnotationWorkflowError(
            "at least one annotator ID is required"
        )
    validated: list[str] = []
    seen: set[str] = set()
    for index, annotator_id in enumerate(annotator_ids):
        if (
            type(annotator_id) is not str
            or not annotator_id
            or annotator_id != annotator_id.strip()
        ):
            raise AnnotationWorkflowError(
                f"annotator ID at index {index} must be non-empty "
                "without surrounding whitespace"
            )
        if any(character in annotator_id for character in ("/", "\\")):
            raise AnnotationWorkflowError(
                f"annotator ID {annotator_id!r} must not contain "
                "path separators"
            )
        if annotator_id in seen:
            raise AnnotationWorkflowError(
                f"duplicate annotator ID {annotator_id!r}"
            )
        seen.add(annotator_id)
        validated.append(annotator_id)
    return tuple(validated)


def _shuffle_pairs(
    pairs: Sequence[tuple[CvRecord, JobRecord]],
    seed: str,
    annotator_id: str,
) -> list[tuple[CvRecord, JobRecord]]:
    material = f"{seed}\0{annotator_id}".encode("utf-8")
    deterministic_seed = int.from_bytes(
        hashlib.sha256(material).digest(),
        byteorder="big",
    )
    ordered = list(pairs)
    random.Random(deterministic_seed).shuffle(ordered)
    return ordered


def _write_annotation_packet(
    path: Path,
    annotator_id: str,
    pairs: Sequence[tuple[CvRecord, JobRecord]],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(_PACKET_HEADER)
        for cv, job in pairs:
            writer.writerow(
                [
                    pair_id(cv.id, job.id),
                    annotator_id,
                    cv.id,
                    job.id,
                    cv.text,
                    _serialize_skills(cv.skills),
                    job.text,
                    _serialize_skills(job.skills),
                    "",
                    "",
                ]
            )


def _serialize_skills(skills: Sequence[str]) -> str:
    return json.dumps(
        list(skills),
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _load_manifest(path: Path, dataset: SourceDataset) -> AnnotationManifest:
    value = _read_json(path, "manifest")
    expected_keys = {
        "datasetName",
        "cvCount",
        "jobCount",
        "pairCountPerAnnotator",
        "annotatorIds",
        "seed",
        "packetFiles",
    }
    if type(value) is not dict or set(value) != expected_keys:
        raise AnnotationWorkflowError(
            "manifest.json: schema does not match the prepare contract"
        )
    annotator_value = value["annotatorIds"]
    packet_value = value["packetFiles"]
    if type(annotator_value) is not list:
        raise AnnotationWorkflowError(
            "manifest.json: annotatorIds must be an array"
        )
    annotators = _validate_annotator_ids(annotator_value)
    if type(packet_value) is not list or any(
        type(file_name) is not str
        for file_name in packet_value
    ):
        raise AnnotationWorkflowError(
            "manifest.json: packetFiles must be an array of strings"
        )
    expected_packets = tuple(
        f"annotations-{annotator_id}.csv"
        for annotator_id in annotators
    )
    if tuple(packet_value) != expected_packets:
        raise AnnotationWorkflowError(
            "manifest.json: packetFiles do not match annotatorIds"
        )
    expected_pair_count = len(dataset.cvs) * len(dataset.jobs)
    expected_values = {
        "datasetName": dataset.name,
        "cvCount": len(dataset.cvs),
        "jobCount": len(dataset.jobs),
        "pairCountPerAnnotator": expected_pair_count,
    }
    for field, expected in expected_values.items():
        if type(value[field]) is not type(expected) or value[field] != expected:
            raise AnnotationWorkflowError(
                f"manifest.json: {field} does not match the dataset"
            )
    if type(value["seed"]) is not str or not value["seed"]:
        raise AnnotationWorkflowError(
            "manifest.json: seed must be a non-empty string"
        )
    return AnnotationManifest(
        dataset_name=dataset.name,
        cv_count=len(dataset.cvs),
        job_count=len(dataset.jobs),
        pair_count_per_annotator=expected_pair_count,
        annotator_ids=annotators,
        seed=value["seed"],
        packet_files=expected_packets,
    )


def _load_completed_packet(
    path: Path,
    annotator_id: str,
    dataset: SourceDataset,
) -> dict[tuple[int, int], int]:
    rows = _read_csv_rows(path, _PACKET_HEADER)
    cv_by_id = {cv.id: cv for cv in dataset.cvs}
    job_by_id = {job.id: job for job in dataset.jobs}
    expected_pairs = {
        (cv.id, job.id)
        for cv in dataset.cvs
        for job in dataset.jobs
    }
    labels: dict[tuple[int, int], int] = {}
    for line_number, row in rows:
        if row["annotator_id"] != annotator_id:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: annotator_id must be "
                f"{annotator_id!r}"
            )
        cv_id = _parse_positive_id(
            row["cv_id"],
            f"{path.name}:{line_number}: cv_id",
        )
        job_id = _parse_positive_id(
            row["job_id"],
            f"{path.name}:{line_number}: job_id",
        )
        pair = (cv_id, job_id)
        if pair not in expected_pairs:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: unexpected pair "
                f"cv_id={cv_id}, job_id={job_id}"
            )
        if pair in labels:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: duplicate pair "
                f"cv_id={cv_id}, job_id={job_id}"
            )
        if row["pair_id"] != pair_id(cv_id, job_id):
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: pair_id was modified"
            )

        cv = cv_by_id[cv_id]
        job = job_by_id[job_id]
        expected_content = {
            "cv_text": cv.text,
            "cv_skills": _serialize_skills(cv.skills),
            "job_text": job.text,
            "job_skills": _serialize_skills(job.skills),
        }
        for field, expected in expected_content.items():
            if row[field] != expected:
                raise AnnotationWorkflowError(
                    f"{path.name}:{line_number}: {field} was modified"
                )
        relevance = row["relevance"]
        if relevance == "":
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: relevance must not be blank"
            )
        if relevance not in _RELEVANCE_VALUES:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: relevance must be 0, 1, or 2"
            )
        labels[pair] = int(relevance)

    missing_pairs = sorted(expected_pairs - set(labels))
    if missing_pairs:
        cv_id, job_id = missing_pairs[0]
        raise AnnotationWorkflowError(
            f"{path.name}: missing pair cv_id={cv_id}, job_id={job_id}"
        )
    return labels


def _combine_annotations(
    dataset: SourceDataset,
    annotations: Mapping[str, Mapping[tuple[int, int], int]],
) -> tuple[ReviewedPair, ...]:
    return tuple(
        ReviewedPair(
            cv_id=cv.id,
            job_id=job.id,
            relevance_by_annotator=MappingProxyType(
                {
                    annotator_id: labels[(cv.id, job.id)]
                    for annotator_id, labels in annotations.items()
                }
            ),
        )
        for cv in dataset.cvs
        for job in dataset.jobs
    )


def _build_agreement_summary(
    dataset: SourceDataset,
    annotator_ids: Sequence[str],
    pairs: Sequence[ReviewedPair],
) -> dict[str, object]:
    unanimous_count = sum(
        pair.unanimous_relevance is not None
        for pair in pairs
    )
    distributions = {
        annotator_id: {
            label: sum(
                pair.relevance_by_annotator[annotator_id] == int(label)
                for pair in pairs
            )
            for label in ("0", "1", "2")
        }
        for annotator_id in annotator_ids
    }
    return {
        "annotatorCount": len(annotator_ids),
        "cvCount": len(dataset.cvs),
        "jobCount": len(dataset.jobs),
        "pairCount": len(pairs),
        "unanimousPairCount": unanimous_count,
        "disagreementPairCount": len(pairs) - unanimous_count,
        "exactAgreementRate": round(unanimous_count / len(pairs), 6),
        "labelDistribution": distributions,
    }


def _write_disagreements(
    path: Path,
    annotator_ids: Sequence[str],
    pairs: Sequence[ReviewedPair],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(
            [
                "pair_id",
                "cv_id",
                "job_id",
                *(
                    f"relevance_{annotator_id}"
                    for annotator_id in annotator_ids
                ),
                "final_relevance",
                "adjudication_notes",
            ]
        )
        for pair in pairs:
            if pair.unanimous_relevance is not None:
                continue
            writer.writerow(
                [
                    pair_id(pair.cv_id, pair.job_id),
                    pair.cv_id,
                    pair.job_id,
                    *(
                        pair.relevance_by_annotator[annotator_id]
                        for annotator_id in annotator_ids
                    ),
                    "",
                    "",
                ]
            )


def _write_adjudication(
    path: Path,
    pairs: Sequence[ReviewedPair],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(_ADJUDICATION_HEADER)
        for pair in pairs:
            unanimous = pair.unanimous_relevance
            writer.writerow(
                [
                    pair.cv_id,
                    pair.job_id,
                    "" if unanimous is None else unanimous,
                    "true" if unanimous is None else "false",
                ]
            )


def _load_final_adjudication(
    path: Path,
    dataset: SourceDataset,
) -> dict[tuple[int, int], int]:
    rows = _read_csv_rows(path, _ADJUDICATION_HEADER)
    expected_pairs = {
        (cv.id, job.id)
        for cv in dataset.cvs
        for job in dataset.jobs
    }
    judgments: dict[tuple[int, int], int] = {}
    for line_number, row in rows:
        cv_id = _parse_positive_id(
            row["cv_id"],
            f"{path.name}:{line_number}: cv_id",
        )
        job_id = _parse_positive_id(
            row["job_id"],
            f"{path.name}:{line_number}: job_id",
        )
        pair = (cv_id, job_id)
        if pair not in expected_pairs:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: unexpected pair "
                f"cv_id={cv_id}, job_id={job_id}"
            )
        if pair in judgments:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: duplicate pair "
                f"cv_id={cv_id}, job_id={job_id}"
            )
        relevance = row["relevance"]
        if relevance == "":
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: relevance must not be blank"
            )
        if relevance not in _RELEVANCE_VALUES:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: relevance must be 0, 1, or 2"
            )
        if row["requires_adjudication"] not in {"true", "false"}:
            raise AnnotationWorkflowError(
                f"{path.name}:{line_number}: requires_adjudication must "
                "be true or false"
            )
        judgments[pair] = int(relevance)

    missing_pairs = sorted(expected_pairs - set(judgments))
    if missing_pairs:
        cv_id, job_id = missing_pairs[0]
        raise AnnotationWorkflowError(
            f"{path.name}: missing pair cv_id={cv_id}, job_id={job_id}"
        )
    for cv in dataset.cvs:
        if not any(
            relevance > 0
            for (cv_id, _), relevance in judgments.items()
            if cv_id == cv.id
        ):
            raise AnnotationWorkflowError(
                f"cv_id={cv.id} must have at least one Job with "
                "relevance greater than 0"
            )
    return judgments


def _read_csv_rows(
    path: Path,
    expected_header: Sequence[str],
) -> list[tuple[int, dict[str, str]]]:
    try:
        stream = path.open("r", encoding="utf-8", newline="")
    except FileNotFoundError as error:
        raise AnnotationWorkflowError(
            f"required annotation file is missing: {path.name}"
        ) from error
    except (OSError, UnicodeError) as error:
        raise AnnotationWorkflowError(
            f"{path.name}: cannot be read as UTF-8: {error}"
        ) from error

    try:
        with stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != list(expected_header):
                raise AnnotationWorkflowError(
                    f"{path.name}: CSV header does not match the contract"
                )
            rows: list[tuple[int, dict[str, str]]] = []
            for line_number, row in enumerate(reader, start=2):
                if None in row or any(value is None for value in row.values()):
                    raise AnnotationWorkflowError(
                        f"{path.name}:{line_number}: column count does "
                        "not match the header"
                    )
                rows.append((line_number, row))
            return rows
    except csv.Error as error:
        raise AnnotationWorkflowError(
            f"{path.name}: malformed CSV: {error}"
        ) from error


def _parse_positive_id(value: str, path: str) -> int:
    if not _POSITIVE_INTEGER_PATTERN.fullmatch(value):
        raise AnnotationWorkflowError(
            f"{path}: expected a positive integer"
        )
    return int(value)


def _read_json(path: Path, label: str) -> object:
    try:
        source = path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise AnnotationWorkflowError(
            f"required {label} file is missing: {path.name}"
        ) from error
    except (OSError, UnicodeError) as error:
        raise AnnotationWorkflowError(
            f"{path.name}: cannot be read as UTF-8: {error}"
        ) from error
    try:
        return json.loads(
            source,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_json_constant,
        )
    except (json.JSONDecodeError, ValueError) as error:
        raise AnnotationWorkflowError(
            f"{path.name}: malformed JSON: {error}"
        ) from error


def _reject_duplicate_keys(
    pairs: list[tuple[str, object]],
) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate object key {key!r}")
        result[key] = value
    return result


def _reject_json_constant(value: str) -> object:
    raise ValueError(f"non-standard numeric constant {value!r}")


def _write_json(path: Path, value: object) -> None:
    rendered = json.dumps(value, ensure_ascii=False, indent=2)
    path.write_text(f"{rendered}\n", encoding="utf-8", newline="\n")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare and validate independent offline recommendation "
            "annotation workflows."
        )
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare_parser = subparsers.add_parser(
        "prepare",
        help="Create independently shuffled annotation packets.",
    )
    prepare_parser.add_argument("--dataset", required=True, type=Path)
    prepare_parser.add_argument(
        "--annotators",
        required=True,
        nargs="+",
    )
    prepare_parser.add_argument("--output-dir", required=True, type=Path)
    prepare_parser.add_argument("--seed", required=True)

    review_parser = subparsers.add_parser(
        "review",
        help="Validate completed packets and create adjudication worksheets.",
    )
    review_parser.add_argument("--dataset", required=True, type=Path)
    review_parser.add_argument(
        "--annotations-dir",
        required=True,
        type=Path,
    )
    review_parser.add_argument("--output-dir", required=True, type=Path)

    finalize_parser = subparsers.add_parser(
        "finalize",
        help="Validate adjudicated labels and write final judgments.csv.",
    )
    finalize_parser.add_argument("--dataset", required=True, type=Path)
    finalize_parser.add_argument(
        "--adjudication",
        required=True,
        type=Path,
    )
    finalize_parser.add_argument("--output", required=True, type=Path)
    finalize_parser.add_argument("--force", action="store_true")
    return parser


def main(arguments: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(arguments)
    try:
        if args.command == "prepare":
            prepare_annotation_packets(
                args.dataset,
                args.annotators,
                args.output_dir,
                seed=args.seed,
            )
        elif args.command == "review":
            review_annotations(
                args.dataset,
                args.annotations_dir,
                args.output_dir,
            )
        else:
            finalize_judgments(
                args.dataset,
                args.adjudication,
                args.output,
                force=args.force,
            )
    except (AnnotationWorkflowError, DatasetValidationError, OSError) as error:
        print(f"Annotation workflow failed: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
