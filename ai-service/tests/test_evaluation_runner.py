"""Integration tests for deterministic offline evaluation output."""

from __future__ import annotations

import csv
from decimal import Decimal
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import pytest

import evaluation.runner as runner
from v2.schemas import RecommendationResult, ScoringStrategy


TOY_DATASET = (
    Path(__file__).resolve().parents[1]
    / "evaluation"
    / "examples"
    / "toy-v1"
)
OUTPUT_FILES = ("summary.json", "per_cv.csv", "rankings.csv")


def _result(
    *,
    job_id: int,
    score: float,
    text_score: float | None,
    skill_score: float,
) -> RecommendationResult:
    return RecommendationResult(
        jobId=job_id,
        score=score,
        textScore=text_score,
        skillScore=skill_score,
        scoringStrategy=(
            ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
            if text_score is None
            else ScoringStrategy.SAME_LANGUAGE_HYBRID
        ),
        matchedSkills=[],
        missingSkills=[],
        reason="Evaluation fixture result.",
    )


def test_component_rankings_use_job_id_for_ties_and_zero_for_null_text() -> None:
    results = [
        _result(
            job_id=2,
            score=0.5,
            text_score=0.0,
            skill_score=0.5,
        ),
        _result(
            job_id=1,
            score=0.5,
            text_score=None,
            skill_score=0.5,
        ),
    ]

    rankings = runner.build_component_rankings(
        results,
        expected_job_ids={1, 2},
    )

    assert [entry.job_id for entry in rankings["production_hybrid"]] == [
        1,
        2,
    ]
    assert [entry.job_id for entry in rankings["skill_only"]] == [1, 2]
    assert [entry.job_id for entry in rankings["text_only"]] == [1, 2]
    assert rankings["text_only"][0].score == 0.0


def test_runner_uses_real_requests_and_writes_complete_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured_requests = []
    production_recommend = runner.recommend_bilingual

    def capture_request(request, *, catalog):
        captured_requests.append(request)
        return production_recommend(request, catalog=catalog)

    monkeypatch.setattr(runner, "recommend_bilingual", capture_request)
    output = tmp_path / "output"

    summary = runner.run_evaluation(
        TOY_DATASET,
        k=5,
        output_directory=output,
    )

    assert len(captured_requests) == 2
    for request, cv_id in zip(captured_requests, (1, 2), strict=True):
        assert request.requestId == uuid5(
            NAMESPACE_URL,
            f"student-job-recommendation-evaluation:cv:{cv_id}",
        )
        assert request.threshold == Decimal("0")
        assert request.limit == 6
        assert [job.id for job in request.jobs] == [
            101,
            102,
            103,
            104,
            105,
            106,
        ]

    assert summary["datasetName"] == "toy-v1"
    assert summary["cvCount"] == 2
    assert summary["jobCount"] == 6
    assert summary["judgmentCount"] == 12
    assert summary["k"] == 5
    assert summary["algorithm"] == "tfidf-cosine-hybrid"
    assert summary["algorithmVersion"] == "bilingual-recommendation-v2"
    assert set(summary["metrics"]) == {
        "production_hybrid",
        "text_only",
        "skill_only",
    }

    with (output / "per_cv.csv").open(
        encoding="utf-8",
        newline="",
    ) as stream:
        per_cv_rows = list(csv.DictReader(stream))
    with (output / "rankings.csv").open(
        encoding="utf-8",
        newline="",
    ) as stream:
        ranking_rows = list(csv.DictReader(stream))
    assert len(per_cv_rows) == 2 * 3
    assert len(ranking_rows) == 2 * 3 * 6
    assert {
        row["model"]
        for row in per_cv_rows
    } == {
        "production_hybrid",
        "text_only",
        "skill_only",
    }
    for file_name in OUTPUT_FILES:
        assert not (output / file_name).read_bytes().startswith(b"\xef\xbb\xbf")


def test_runner_output_is_byte_for_byte_deterministic(tmp_path: Path) -> None:
    first_output = tmp_path / "first"
    second_output = tmp_path / "second"

    first_summary = runner.run_evaluation(
        TOY_DATASET,
        k=5,
        output_directory=first_output,
    )
    second_summary = runner.run_evaluation(
        TOY_DATASET,
        k=5,
        output_directory=second_output,
    )

    assert first_summary == second_summary
    for file_name in OUTPUT_FILES:
        assert (first_output / file_name).read_bytes() == (
            second_output / file_name
        ).read_bytes()
    parsed_summary = json.loads(
        (first_output / "summary.json").read_text(encoding="utf-8")
    )
    assert "timestamp" not in parsed_summary


def test_cli_returns_nonzero_for_invalid_dataset(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = runner.main(
        [
            "--dataset",
            str(tmp_path / "missing"),
            "--k",
            "5",
            "--output-dir",
            str(tmp_path / "output"),
        ]
    )

    assert exit_code != 0
    assert "Evaluation failed:" in capsys.readouterr().err
    assert not (tmp_path / "output").exists()
