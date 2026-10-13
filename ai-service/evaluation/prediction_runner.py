"""Evaluate frozen Student V3 predictions against independent external labels."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import platform
import sys
from typing import Sequence

from .dataset import DatasetValidationError, _read_json, load_dataset
from .metrics import f1_at_k, ndcg_at_k, precision_at_k, recall_at_k, validate_relevance_threshold
from .predictions import ALGORITHM, ALGORITHM_VERSION, load_predictions


def evaluate_predictions(
    dataset_directory: str | Path,
    predictions_path: str | Path,
    *,
    output_directory: str | Path,
    ground_truth_kind: str,
    k: int = 5,
    relevance_threshold: int = 1,
    dataset_version: str | None = None,
    label_version: str | None = None,
    experiment_manifest: str | Path | None = None,
    allow_unranked: bool = False,
) -> dict[str, object]:
    """Write deterministic metrics and sanitized prediction evidence; no AI/DB access."""

    if type(k) is not int or k <= 0:
        raise ValueError("k must be a positive integer")
    validate_relevance_threshold(relevance_threshold)
    if ground_truth_kind not in ("SYNTHETIC", "HUMAN_LABELED"):
        raise ValueError("ground_truth_kind must be SYNTHETIC or HUMAN_LABELED")
    for version in (dataset_version, label_version):
        if version is not None and (type(version) is not str or not version.strip()):
            raise ValueError("dataset/label versions must be nonblank when supplied")
    dataset_path = Path(dataset_directory)
    examples_path = Path(__file__).parent / "examples"
    if ground_truth_kind == "HUMAN_LABELED" and dataset_path.resolve().is_relative_to(examples_path.resolve()):
        raise ValueError("checked-in examples are SYNTHETIC, never human quality evidence")
    dataset = load_dataset(dataset_path, prediction_evaluation=True)
    predictions_path = Path(predictions_path)
    entries = load_predictions(predictions_path, allow_unranked=allow_unranked)
    if {entry["run"]["cvId"] for entry in entries} != {cv.id for cv in dataset.cvs}:
        raise DatasetValidationError("predictions must contain exactly one run for every labeled CV")

    input_paths = {
        "predictions": predictions_path,
        **{name: dataset_path / name for name in ("cvs.json", "jobs.json", "judgments.csv")},
    }
    if experiment_manifest is not None:
        manifest_path = Path(experiment_manifest)
        if type(_read_json(manifest_path)) is not dict:
            raise DatasetValidationError("experiment manifest must be a JSON object")
        input_paths["experimentManifest"] = manifest_path
    output_path = Path(output_directory)
    output_files = ("summary.json", "per_cv.csv", "rankings.csv", "predictions.json")
    if any(
        (output_path / name).resolve() == source.resolve()
        for name in output_files for source in input_paths.values()
    ):
        raise ValueError("evaluation output must not overwrite an input file")

    per_cv = []
    ranking_rows = []
    run_evidence = []
    for entry in entries:
        run = entry["run"]
        cv_id = run["cvId"]
        # Count agreement is necessary, but does not prove historical corpus identity.
        if run["totalJobsScanned"] != len(dataset.jobs):
            raise DatasetValidationError("totalJobsScanned must match the frozen labeled Job corpus count")
        relevance = {job.id: dataset.relevance_for(cv_id, job.id) for job in dataset.jobs}
        ranking = [row["jobId"] for row in run["results"]]
        metric_args = {"relevance_threshold": relevance_threshold}
        metrics = {
            "precisionAtK": precision_at_k(ranking, relevance, k, **metric_args),
            "recallAtK": recall_at_k(ranking, relevance, k, **metric_args),
            "f1AtK": f1_at_k(ranking, relevance, k, **metric_args),
            "ndcgAtK": ndcg_at_k(ranking, relevance, k),
        }
        per_cv.append({
            "cvId": cv_id, "runId": run["id"],
            "retrievedCountAtK": min(k, len(ranking)),
            "relevantJobCount": sum(label >= relevance_threshold for label in relevance.values()),
            **metrics,
        })
        run_evidence.append({
            key: run[key] for key in (
                "id", "cvId", "totalJobsScanned", "totalRecommended",
                "startedAt", "finishedAt", "createdAt",
            )
        } | {"orderSource": entry["orderSource"]})
        for position, result in enumerate(run["results"], start=1):
            ranking_rows.append({
                "cvId": cv_id, "runId": run["id"], "evaluationPosition": position,
                **result, "relevance": relevance[result["jobId"]],
            })

    config = {
        "evaluatorVersion": "student-v3-predictions-v1",
        "k": k, "relevanceThreshold": relevance_threshold,
        "labelScale": {"0": "not relevant", "1": "relevant", "2": "highly relevant"},
        "aggregation": "macro mean of per-CV metrics, including zero-relevant CVs",
        "zeroRelevantPolicy": "recall=0; f1=0; ndcg=0 only when ideal graded DCG=0",
        "allowUnranked": allow_unranked,
        "declaredGroundTruthKind": ground_truth_kind,
        "datasetVersion": dataset_version, "labelVersion": label_version,
    }
    tooling_paths = [Path(__file__).parent / name for name in (
        "prediction_runner.py", "predictions.py", "metrics.py", "dataset.py",
    )]
    lock_path = Path(__file__).parents[1] / "requirements.lock"
    identity = {
        "config": config,
        "inputSha256": {name: _sha256(path) for name, path in input_paths.items()},
        "toolingSha256": {path.name: _sha256(path) for path in tooling_paths},
        "requirementsLockSha256": _sha256(lock_path),
        "pythonVersion": platform.python_version(),
    }
    evaluation_id = hashlib.sha256(
        json.dumps(identity, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    summary = {
        "evaluationId": evaluation_id,
        "evaluationType": "frozen_student_v3_predictions",
        "datasetName": dataset.name,
        "cvCount": len(dataset.cvs), "jobCount": len(dataset.jobs),
        "judgmentCount": dataset.judgment_count,
        "algorithm": ALGORITHM, "algorithmVersion": ALGORITHM_VERSION,
        **identity, "runs": run_evidence,
        "metrics": {
            name: round(sum(row[name] for row in per_cv) / len(per_cv), 6)
            for name in ("precisionAtK", "recallAtK", "f1AtK", "ndcgAtK")
        },
        "limitations": [
            "Ground-truth provenance is declared by the operator, not independently verified by this tool.",
            "Scores are ranking evidence, not accuracy or model confidence.",
            "Reproduces metrics from frozen predictions; does not reconstruct historical scoring inputs.",
            "Matching scanned counts does not prove historical corpus membership; freeze it during the experiment.",
            "Requirement lock hash identifies a file, not a verified installed environment.",
        ],
    }
    # Complete validation before creating artifacts; no partial output for invalid evidence.
    output_path.mkdir(parents=True, exist_ok=True)
    _write_json(output_path / "summary.json", summary)
    _write_json(output_path / "predictions.json", [entry["run"] for entry in entries])
    _write_csv(output_path / "per_cv.csv", per_cv, list(per_cv[0]))
    _write_csv(output_path / "rankings.csv", ranking_rows, [
        "cvId", "runId", "evaluationPosition", "jobId", "rankPosition",
        "tierRankPosition", "rankingTier", "rankingScore", "textScore",
        "skillScore", "overallScore", "scoringStrategy", "relevance",
    ])
    return summary


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def _write_csv(path: Path, rows: list[dict[str, object]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: f"{value:.6f}" if isinstance(value, float) and key.endswith("AtK") else value
                             for key, value in row.items()})


def main(arguments: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path,
                        help="JSON array of complete saved public V3 run details/envelopes")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--ground-truth-kind", required=True, choices=("SYNTHETIC", "HUMAN_LABELED"))
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--relevance-threshold", type=int, choices=(1, 2), default=1)
    parser.add_argument("--dataset-version")
    parser.add_argument("--label-version")
    parser.add_argument("--experiment-manifest", type=Path)
    parser.add_argument("--allow-unranked", action="store_true",
                        help="Opt in to reconstruction from exact unrounded scores; never use for public history")
    args = parser.parse_args(arguments)
    try:
        evaluate_predictions(
            args.dataset, args.predictions, output_directory=args.output_dir,
            ground_truth_kind=args.ground_truth_kind, k=args.k,
            relevance_threshold=args.relevance_threshold,
            dataset_version=args.dataset_version, label_version=args.label_version,
            experiment_manifest=args.experiment_manifest, allow_unranked=args.allow_unranked,
        )
    except (ValueError, OSError) as error:
        print(f"Prediction evaluation failed: {error}", file=sys.stderr)
        return 2
    print(f"Prediction evaluation output written to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
