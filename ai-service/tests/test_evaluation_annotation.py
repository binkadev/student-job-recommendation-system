"""Tests for independent annotation preparation, review, and finalization."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Callable

import pytest

from evaluation.annotation import (
    AnnotationWorkflowError,
    finalize_judgments,
    main,
    prepare_annotation_packets,
    review_annotations,
)


CVS = [
    {
        "id": 1,
        "text": 'Kỹ sư backend,\nkinh nghiệm "Java" và REST API.',
        "skills": ["Java", "Spring Boot"],
    },
    {
        "id": 2,
        "text": "Python backend engineer with API testing experience.",
        "skills": ["Python", "FastAPI"],
    },
]
JOBS = [
    {
        "id": 101,
        "text": 'Lập trình viên Java,\nphát triển "REST API".',
        "skills": ["Java", "REST API"],
    },
    {
        "id": 102,
        "text": "Python developer building FastAPI services.",
        "skills": ["Python", "FastAPI"],
    },
]
LABELS = {
    "A01": {
        (1, 101): 2,
        (1, 102): 0,
        (2, 101): 0,
        (2, 102): 2,
    },
    "A02": {
        (1, 101): 2,
        (1, 102): 1,
        (2, 101): 0,
        (2, 102): 2,
    },
}
FORBIDDEN_PACKET_FIELDS = {
    "score",
    "rank",
    "reason",
    "textScore",
    "skillScore",
    "matchedSkills",
    "missingSkills",
}
TOY_DATASET = (
    Path(__file__).resolve().parents[1]
    / "evaluation"
    / "examples"
    / "toy-v1"
)


def _write_source_dataset(directory: Path) -> Path:
    directory.mkdir()
    (directory / "cvs.json").write_text(
        json.dumps(CVS, ensure_ascii=False),
        encoding="utf-8",
    )
    (directory / "jobs.json").write_text(
        json.dumps(JOBS, ensure_ascii=False),
        encoding="utf-8",
    )
    return directory


def _read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        return list(reader.fieldnames or []), list(reader)


def _write_csv(
    path: Path,
    header: list[str],
    rows: list[dict[str, str]],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=header,
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)


def _prepare(
    tmp_path: Path,
    *,
    output_name: str = "packets",
) -> tuple[Path, Path]:
    dataset = _write_source_dataset(tmp_path / f"dataset-{output_name}")
    output = tmp_path / output_name
    prepare_annotation_packets(
        dataset,
        ["A01", "A02"],
        output,
        seed="pilot-v1",
    )
    return dataset, output


def _complete_packets(
    packet_directory: Path,
    labels: dict[str, dict[tuple[int, int], int]] = LABELS,
) -> None:
    for annotator_id, annotator_labels in labels.items():
        path = packet_directory / f"annotations-{annotator_id}.csv"
        header, rows = _read_csv(path)
        for row in rows:
            pair = (int(row["cv_id"]), int(row["job_id"]))
            row["relevance"] = str(annotator_labels[pair])
        _write_csv(path, header, rows)


def _mutate_packet(
    path: Path,
    mutation: Callable[[list[dict[str, str]]], None],
) -> None:
    header, rows = _read_csv(path)
    mutation(rows)
    _write_csv(path, header, rows)


def test_prepare_creates_complete_deterministic_blinded_packets(
    tmp_path: Path,
) -> None:
    dataset = _write_source_dataset(tmp_path / "dataset")
    first = tmp_path / "first"
    second = tmp_path / "second"

    first_manifest = prepare_annotation_packets(
        dataset,
        ["A01", "A02"],
        first,
        seed="pilot-v1",
    )
    second_manifest = prepare_annotation_packets(
        dataset,
        ["A01", "A02"],
        second,
        seed="pilot-v1",
    )

    assert first_manifest == second_manifest == {
        "datasetName": "dataset",
        "cvCount": 2,
        "jobCount": 2,
        "pairCountPerAnnotator": 4,
        "annotatorIds": ["A01", "A02"],
        "seed": "pilot-v1",
        "packetFiles": [
            "annotations-A01.csv",
            "annotations-A02.csv",
        ],
    }
    orders = {}
    for annotator_id in ("A01", "A02"):
        file_name = f"annotations-{annotator_id}.csv"
        assert (first / file_name).read_bytes() == (
            second / file_name
        ).read_bytes()
        header, rows = _read_csv(first / file_name)
        assert len(rows) == 4
        assert len(
            {
                (row["cv_id"], row["job_id"])
                for row in rows
            }
        ) == 4
        assert all(row["relevance"] == "" for row in rows)
        assert all(row["notes"] == "" for row in rows)
        assert all(row["annotator_id"] == annotator_id for row in rows)
        assert FORBIDDEN_PACKET_FIELDS.isdisjoint(header)
        assert "Kỹ sư backend,\n" in (
            first / file_name
        ).read_text(encoding="utf-8")
        assert not (first / file_name).read_bytes().startswith(b"\xef\xbb\xbf")
        orders[annotator_id] = [
            (row["cv_id"], row["job_id"])
            for row in rows
        ]
    assert orders["A01"] != orders["A02"]
    assert (first / "manifest.json").read_bytes() == (
        second / "manifest.json"
    ).read_bytes()


def test_prepare_rejects_empty_skills_and_same_output_directory(
    tmp_path: Path,
) -> None:
    dataset = _write_source_dataset(tmp_path / "dataset")
    cvs = json.loads((dataset / "cvs.json").read_text(encoding="utf-8"))
    cvs[0]["skills"] = []
    (dataset / "cvs.json").write_text(
        json.dumps(cvs),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="at least one string"):
        prepare_annotation_packets(
            dataset,
            ["A01"],
            tmp_path / "packets",
            seed="seed",
        )

    valid_dataset = _write_source_dataset(tmp_path / "valid")
    with pytest.raises(
        AnnotationWorkflowError,
        match="must differ",
    ):
        prepare_annotation_packets(
            valid_dataset,
            ["A01"],
            valid_dataset,
            seed="seed",
        )


def test_review_calculates_agreement_and_leaves_disagreements_unresolved(
    tmp_path: Path,
) -> None:
    dataset, packets = _prepare(tmp_path)
    _complete_packets(packets)
    output = tmp_path / "review"

    summary = review_annotations(dataset, packets, output)

    assert summary == {
        "annotatorCount": 2,
        "cvCount": 2,
        "jobCount": 2,
        "pairCount": 4,
        "unanimousPairCount": 3,
        "disagreementPairCount": 1,
        "exactAgreementRate": 0.75,
        "labelDistribution": {
            "A01": {"0": 2, "1": 0, "2": 2},
            "A02": {"0": 1, "1": 1, "2": 2},
        },
    }
    disagreement_header, disagreements = _read_csv(
        output / "disagreements.csv"
    )
    assert disagreement_header == [
        "pair_id",
        "cv_id",
        "job_id",
        "relevance_A01",
        "relevance_A02",
        "final_relevance",
        "adjudication_notes",
    ]
    assert disagreements == [
        {
            "pair_id": "cv-1-job-102",
            "cv_id": "1",
            "job_id": "102",
            "relevance_A01": "0",
            "relevance_A02": "1",
            "final_relevance": "",
            "adjudication_notes": "",
        }
    ]
    _, adjudication = _read_csv(
        output / "judgments.adjudication.csv"
    )
    disagreement = next(
        row
        for row in adjudication
        if row["cv_id"] == "1" and row["job_id"] == "102"
    )
    assert disagreement["relevance"] == ""
    assert disagreement["requires_adjudication"] == "true"
    for file_name in (
        "agreement-summary.json",
        "disagreements.csv",
        "judgments.adjudication.csv",
    ):
        assert not (output / file_name).read_bytes().startswith(b"\xef\xbb\xbf")


def test_checked_in_synthetic_packets_and_manual_adjudication_fixture(
    tmp_path: Path,
) -> None:
    annotations = TOY_DATASET / "annotations"
    review_output = tmp_path / "review"

    summary = review_annotations(
        TOY_DATASET,
        annotations,
        review_output,
    )
    finalized = finalize_judgments(
        TOY_DATASET,
        annotations / "judgments.adjudication.synthetic-completed.csv",
        tmp_path / "judgments.csv",
    )

    assert summary["unanimousPairCount"] == 9
    assert summary["disagreementPairCount"] == 3
    assert summary["exactAgreementRate"] == 0.75
    assert len(_read_csv(finalized)[1]) == 12


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda rows: rows.pop(), "missing pair"),
        (lambda rows: rows.append(dict(rows[0])), "duplicate pair"),
        (
            lambda rows: rows[0].__setitem__("cv_id", "999"),
            "unexpected pair",
        ),
        (
            lambda rows: rows[0].__setitem__("pair_id", "modified"),
            "pair_id was modified",
        ),
        (
            lambda rows: rows[0].__setitem__("cv_text", "modified"),
            "cv_text was modified",
        ),
        (
            lambda rows: rows[0].__setitem__("relevance", ""),
            "relevance must not be blank",
        ),
        (
            lambda rows: rows[0].__setitem__("relevance", "3"),
            "relevance must be 0, 1, or 2",
        ),
    ],
)
def test_review_rejects_incomplete_or_modified_packets(
    tmp_path: Path,
    mutation: Callable[[list[dict[str, str]]], None],
    message: str,
) -> None:
    dataset, packets = _prepare(tmp_path)
    _complete_packets(packets)
    _mutate_packet(packets / "annotations-A01.csv", mutation)

    with pytest.raises(AnnotationWorkflowError, match=message):
        review_annotations(dataset, packets, tmp_path / "review")


def _resolve_adjudication(path: Path) -> None:
    header, rows = _read_csv(path)
    for row in rows:
        if row["relevance"] == "":
            row["relevance"] = "1"
    _write_csv(path, header, rows)


def test_finalize_writes_sorted_deterministic_judgments(
    tmp_path: Path,
) -> None:
    dataset, packets = _prepare(tmp_path)
    _complete_packets(packets)
    review = tmp_path / "review"
    review_annotations(dataset, packets, review)
    adjudication = review / "judgments.adjudication.csv"
    _resolve_adjudication(adjudication)
    first = tmp_path / "first.csv"
    second = tmp_path / "second.csv"

    finalize_judgments(dataset, adjudication, first)
    finalize_judgments(dataset, adjudication, second)

    assert first.read_bytes() == second.read_bytes()
    assert first.read_text(encoding="utf-8") == (
        "cv_id,job_id,relevance\n"
        "1,101,2\n"
        "1,102,1\n"
        "2,101,0\n"
        "2,102,2\n"
    )
    assert not first.read_bytes().startswith(b"\xef\xbb\xbf")


def test_finalize_rejects_blank_and_cv_without_relevant_job(
    tmp_path: Path,
) -> None:
    dataset, packets = _prepare(tmp_path)
    _complete_packets(packets)
    review = tmp_path / "review"
    review_annotations(dataset, packets, review)
    adjudication = review / "judgments.adjudication.csv"

    with pytest.raises(
        AnnotationWorkflowError,
        match="relevance must not be blank",
    ):
        finalize_judgments(
            dataset,
            adjudication,
            tmp_path / "judgments.csv",
        )

    header, rows = _read_csv(adjudication)
    for row in rows:
        if row["cv_id"] == "1":
            row["relevance"] = "0"
        elif row["relevance"] == "":
            row["relevance"] = "1"
    _write_csv(adjudication, header, rows)
    with pytest.raises(
        AnnotationWorkflowError,
        match="cv_id=1 must have at least one Job",
    ):
        finalize_judgments(
            dataset,
            adjudication,
            tmp_path / "judgments.csv",
        )


def test_finalize_refuses_existing_output_without_force(
    tmp_path: Path,
) -> None:
    dataset, packets = _prepare(tmp_path)
    _complete_packets(packets)
    review = tmp_path / "review"
    review_annotations(dataset, packets, review)
    adjudication = review / "judgments.adjudication.csv"
    _resolve_adjudication(adjudication)
    output = tmp_path / "judgments.csv"
    output.write_text("do not replace", encoding="utf-8")

    with pytest.raises(AnnotationWorkflowError, match="already exists"):
        finalize_judgments(dataset, adjudication, output)

    finalize_judgments(
        dataset,
        adjudication,
        output,
        force=True,
    )
    assert output.read_text(encoding="utf-8").startswith(
        "cv_id,job_id,relevance\n"
    )


def test_cli_returns_nonzero_on_workflow_error(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = main(
        [
            "review",
            "--dataset",
            str(tmp_path / "missing"),
            "--annotations-dir",
            str(tmp_path / "packets"),
            "--output-dir",
            str(tmp_path / "review"),
        ]
    )

    assert exit_code != 0
    assert "Annotation workflow failed:" in capsys.readouterr().err


def test_review_rejects_missing_manifest_and_single_annotator(
    tmp_path: Path,
) -> None:
    dataset = _write_source_dataset(tmp_path / "dataset")
    with pytest.raises(
        AnnotationWorkflowError,
        match="manifest file is missing",
    ):
        review_annotations(
            dataset,
            tmp_path / "missing-packets",
            tmp_path / "review",
        )

    packets = tmp_path / "packets"
    prepare_annotation_packets(
        dataset,
        ["A01"],
        packets,
        seed="seed",
    )
    with pytest.raises(
        AnnotationWorkflowError,
        match="at least 2 annotators",
    ):
        review_annotations(dataset, packets, tmp_path / "review")
