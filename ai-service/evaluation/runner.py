"""CLI runner for deterministic offline recommendation evaluation."""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from decimal import Decimal
import json
from pathlib import Path
import sys
from typing import Sequence
from uuid import NAMESPACE_URL, uuid5

from v2.schemas import (
    CvInput,
    JobInput,
    RecommendationRequest,
    RecommendationResult,
)
from v2.service import recommend_bilingual
from v2.skill_canonicalizer import load_default_catalog

from .dataset import DatasetValidationError, EvaluationDataset, load_dataset
from .metrics import ndcg_at_k, precision_at_k, recall_at_k


_MODEL_NAMES = (
    "production_hybrid",
    "text_only",
    "skill_only",
)
_PRODUCTION_SCORING_DESCRIPTION = (
    "Production V2 scoring: same-language Jobs use 0.65 * textScore + "
    "0.35 * skillScore when declared skills exist, otherwise textScore; "
    "cross-language or insufficient-confidence pairs use skillScore."
)


class EvaluationRunnerError(RuntimeError):
    """Raised when production scoring violates evaluation assumptions."""


@dataclass(frozen=True, slots=True)
class RankingEntry:
    job_id: int
    score: float


@dataclass(frozen=True, slots=True)
class PerCvMetric:
    cv_id: int
    model: str
    precision_at_k: float
    recall_at_k: float
    ndcg_at_k: float
    relevant_job_count: int


def run_evaluation(
    dataset_directory: str | Path,
    *,
    k: int = 5,
    output_directory: str | Path,
) -> dict[str, object]:
    """Score one dataset, write deterministic artifacts, and return summary."""

    if type(k) is not int or k <= 0:
        raise ValueError("k must be a positive integer")

    dataset = load_dataset(dataset_directory)
    catalog = load_default_catalog()
    per_cv_metrics: list[PerCvMetric] = []
    ranking_rows: list[tuple[int, str, int, int, float, int]] = []
    response_algorithm: str | None = None
    response_algorithm_version: str | None = None

    for cv in dataset.cvs:
        request = RecommendationRequest(
            requestId=uuid5(
                NAMESPACE_URL,
                f"student-job-recommendation-evaluation:cv:{cv.id}",
            ),
            cv=CvInput(
                id=cv.id,
                text=cv.text,
                skills=list(cv.skills),
            ),
            jobs=[
                JobInput(
                    id=job.id,
                    text=job.text,
                    skills=list(job.skills),
                )
                for job in dataset.jobs
            ],
            threshold=Decimal("0"),
            limit=len(dataset.jobs),
        )
        response = recommend_bilingual(request, catalog=catalog)
        response_algorithm = _consistent_metadata(
            response_algorithm,
            response.algorithm,
            "algorithm",
        )
        response_algorithm_version = _consistent_metadata(
            response_algorithm_version,
            response.algorithmVersion,
            "algorithmVersion",
        )
        rankings = build_component_rankings(
            response.results,
            expected_job_ids={job.id for job in dataset.jobs},
        )
        relevance_by_job_id = {
            job.id: dataset.relevance_for(cv.id, job.id)
            for job in dataset.jobs
        }
        relevant_job_count = sum(
            relevance >= 1
            for relevance in relevance_by_job_id.values()
        )

        for model in _MODEL_NAMES:
            ranking = rankings[model]
            ranked_job_ids = [entry.job_id for entry in ranking]
            per_cv_metrics.append(
                PerCvMetric(
                    cv_id=cv.id,
                    model=model,
                    precision_at_k=precision_at_k(
                        ranked_job_ids,
                        relevance_by_job_id,
                        k,
                    ),
                    recall_at_k=recall_at_k(
                        ranked_job_ids,
                        relevance_by_job_id,
                        k,
                    ),
                    ndcg_at_k=ndcg_at_k(
                        ranked_job_ids,
                        relevance_by_job_id,
                        k,
                    ),
                    relevant_job_count=relevant_job_count,
                )
            )
            for rank, entry in enumerate(ranking, start=1):
                ranking_rows.append(
                    (
                        cv.id,
                        model,
                        rank,
                        entry.job_id,
                        entry.score,
                        relevance_by_job_id[entry.job_id],
                    )
                )

    if response_algorithm is None or response_algorithm_version is None:
        raise EvaluationRunnerError("dataset produced no scoring responses")

    summary = {
        "datasetName": dataset.name,
        "cvCount": len(dataset.cvs),
        "jobCount": len(dataset.jobs),
        "judgmentCount": dataset.judgment_count,
        "k": k,
        "algorithm": response_algorithm,
        "algorithmVersion": response_algorithm_version,
        "productionScoringDescription": _PRODUCTION_SCORING_DESCRIPTION,
        "metrics": {
            model: _macro_metrics(per_cv_metrics, model)
            for model in _MODEL_NAMES
        },
    }
    output_path = Path(output_directory)
    output_path.mkdir(parents=True, exist_ok=True)
    _write_summary(output_path / "summary.json", summary)
    _write_per_cv(output_path / "per_cv.csv", per_cv_metrics)
    _write_rankings(output_path / "rankings.csv", ranking_rows)
    return summary


def build_component_rankings(
    results: Sequence[RecommendationResult],
    *,
    expected_job_ids: set[int],
) -> dict[str, tuple[RankingEntry, ...]]:
    """Build the three evaluation rankings from production response fields."""

    result_by_job_id: dict[int, RecommendationResult] = {}
    for result in results:
        if result.jobId in result_by_job_id:
            raise EvaluationRunnerError(
                f"production response contains duplicate jobId={result.jobId}"
            )
        result_by_job_id[result.jobId] = result
    actual_job_ids = set(result_by_job_id)
    if actual_job_ids != expected_job_ids:
        missing = sorted(expected_job_ids - actual_job_ids)
        unexpected = sorted(actual_job_ids - expected_job_ids)
        raise EvaluationRunnerError(
            "production response Job IDs do not match the dataset; "
            f"missing={missing}, unexpected={unexpected}"
        )

    score_getters = {
        "production_hybrid": lambda result: result.score,
        "text_only": lambda result: (
            0.0 if result.textScore is None else result.textScore
        ),
        "skill_only": lambda result: result.skillScore,
    }
    rankings: dict[str, tuple[RankingEntry, ...]] = {}
    for model in _MODEL_NAMES:
        entries = [
            RankingEntry(
                job_id=result.jobId,
                score=float(score_getters[model](result)),
            )
            for result in results
        ]
        entries.sort(key=lambda entry: (-entry.score, entry.job_id))
        rankings[model] = tuple(entries)
    return rankings


def _consistent_metadata(
    existing: str | None,
    current: str,
    field_name: str,
) -> str:
    if existing is not None and current != existing:
        raise EvaluationRunnerError(
            f"production response changed {field_name} within one run"
        )
    return current


def _macro_metrics(
    metrics: Sequence[PerCvMetric],
    model: str,
) -> dict[str, float]:
    selected = [metric for metric in metrics if metric.model == model]
    if not selected:
        raise EvaluationRunnerError(
            f"no per-CV metrics were produced for {model}"
        )
    count = len(selected)
    return {
        "precisionAtK": round(
            sum(metric.precision_at_k for metric in selected) / count,
            6,
        ),
        "recallAtK": round(
            sum(metric.recall_at_k for metric in selected) / count,
            6,
        ),
        "ndcgAtK": round(
            sum(metric.ndcg_at_k for metric in selected) / count,
            6,
        ),
    }


def _write_summary(path: Path, summary: dict[str, object]) -> None:
    rendered = json.dumps(
        summary,
        ensure_ascii=False,
        indent=2,
    )
    path.write_text(f"{rendered}\n", encoding="utf-8", newline="\n")


def _write_per_cv(
    path: Path,
    metrics: Sequence[PerCvMetric],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(
            [
                "cv_id",
                "model",
                "precision_at_k",
                "recall_at_k",
                "ndcg_at_k",
                "relevant_job_count",
            ]
        )
        for metric in metrics:
            writer.writerow(
                [
                    metric.cv_id,
                    metric.model,
                    _format_metric(metric.precision_at_k),
                    _format_metric(metric.recall_at_k),
                    _format_metric(metric.ndcg_at_k),
                    metric.relevant_job_count,
                ]
            )


def _write_rankings(
    path: Path,
    rows: Sequence[tuple[int, str, int, int, float, int]],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(
            ["cv_id", "model", "rank", "job_id", "score", "relevance"]
        )
        for cv_id, model, rank, job_id, score, relevance in rows:
            writer.writerow(
                [
                    cv_id,
                    model,
                    rank,
                    job_id,
                    f"{score:.8f}",
                    relevance,
                ]
            )


def _format_metric(value: float) -> str:
    return f"{round(value, 6):.6f}"


def _parse_arguments(arguments: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate production V2 ranking components against a "
            "human-labeled offline dataset."
        )
    )
    parser.add_argument(
        "--dataset",
        required=True,
        type=Path,
        help="Directory containing cvs.json, jobs.json, and judgments.csv.",
    )
    parser.add_argument(
        "--k",
        default=5,
        type=int,
        help="Ranking cutoff for Precision, Recall, and NDCG (default: 5).",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        type=Path,
        help="Directory for summary.json, per_cv.csv, and rankings.csv.",
    )
    return parser.parse_args(arguments)


def main(arguments: Sequence[str] | None = None) -> int:
    args = _parse_arguments(arguments)
    try:
        run_evaluation(
            args.dataset,
            k=args.k,
            output_directory=args.output_dir,
        )
    except (DatasetValidationError, EvaluationRunnerError, ValueError) as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        return 2
    print(f"Evaluation output written to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
