"""Synthetic tests for frozen V3 evidence, official rank order and reproducibility."""

from __future__ import annotations

import copy
import csv
import hashlib
import json
from pathlib import Path
import shutil

import pytest

from evaluation.dataset import DatasetValidationError
from evaluation.prediction_runner import evaluate_predictions, main
from evaluation.predictions import load_predictions, order_results


TOY = Path(__file__).resolve().parents[1] / "evaluation" / "examples" / "toy-v1"
PREDICTIONS = TOY / "student-v3.predictions.synthetic.json"
ARTIFACTS = ("summary.json", "per_cv.csv", "rankings.csv", "predictions.json")


def _runs():
    return json.loads(PREDICTIONS.read_text(encoding="utf-8"))


def _write(path: Path, value) -> Path:
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def _evaluate(tmp_path, predictions=PREDICTIONS, **kwargs):
    return evaluate_predictions(
        TOY, predictions, output_directory=tmp_path / "output",
        ground_truth_kind="SYNTHETIC", **kwargs,
    )


def test_official_ranks_keep_higher_fallback_after_primary() -> None:
    entries = load_predictions(PREDICTIONS)
    assert [row["jobId"] for row in entries[0]["run"]["results"]] == [101, 103, 102]
    assert entries[0]["orderSource"] == "rankPosition"
    assert entries[0]["run"]["results"][-1]["rankingScore"] == 1
    assert [row["tierRankPosition"] for row in entries[0]["run"]["results"]] == [1, 2, 1]


def test_persisted_ranks_override_job_id_on_rounded_score_ties() -> None:
    results = _runs()[0]["results"][1:]
    for row in results:
        row["rankingScore"] = row["overallScore"] = .5
    results[0]["rankPosition"] = results[0]["tierRankPosition"] = 1  # Job 103 first.
    results[1]["rankPosition"] = results[1]["tierRankPosition"] = 2  # Job 101 second.
    ordered, source = order_results(results)
    assert [row["jobId"] for row in ordered] == [103, 101]
    assert source == "rankPosition"


def test_exact_unranked_order_uses_tiers_scores_and_job_id_ties() -> None:
    results = _runs()[0]["results"]
    for row in results:
        row.pop("rankPosition")
        row.pop("tierRankPosition")
        if row["rankingTier"] == "PRIMARY":
            row["rankingScore"] = row["overallScore"] = .5
    with pytest.raises(ValueError, match="rankPosition required"):
        order_results(results)
    ordered, source = order_results(results, allow_unranked=True)
    assert [row["jobId"] for row in ordered] == [101, 103, 102]
    assert source == "reconstructed_v3_order"
    assert all(row["rankPosition"] is None for row in ordered)  # No invented official ranks.


def test_api_envelopes_are_supported_and_private_fields_are_excluded(tmp_path) -> None:
    runs = _runs()
    runs[0]["results"][0].update(jobTitle="PRIVATE SENTINEL", reason="PRIVATE SENTINEL")
    runs[0]["unexpectedPrivateField"] = "PRIVATE SENTINEL"
    source = _write(tmp_path / "input.json", [
        {"success": True, "errorCode": None, "data": run} for run in runs
    ])
    summary = _evaluate(tmp_path, source)
    assert summary["algorithmVersion"] == "bilingual-recommendation-v3"
    for name in ARTIFACTS:
        assert "PRIVATE SENTINEL" not in (tmp_path / "output" / name).read_text(encoding="utf-8")
    exported = load_predictions(tmp_path / "output" / "predictions.json")
    assert exported[0]["run"]["id"] == 9001
    assert exported[0]["run"]["results"][-1]["overallScore"] is None


def test_cutoff_short_lists_macro_f1_and_deterministic_artifacts(tmp_path) -> None:
    summary = _evaluate(tmp_path, k=2, dataset_version="toy-v1", label_version="synthetic-v1")
    assert summary["metrics"]["precisionAtK"] == .75
    assert summary["metrics"]["recallAtK"] == .583333
    assert summary["metrics"]["f1AtK"] == .65  # mean(.5, .8), not F1 of macro P/R.
    assert summary["metrics"]["f1AtK"] != pytest.approx(
        2 * .75 * (7 / 12) / (.75 + 7 / 12)
    )
    assert summary["config"]["relevanceThreshold"] == 1
    assert summary["config"]["declaredGroundTruthKind"] == "SYNTHETIC"
    assert summary["inputSha256"]["predictions"] == hashlib.sha256(PREDICTIONS.read_bytes()).hexdigest()
    repeated = evaluate_predictions(
        TOY, PREDICTIONS, output_directory=tmp_path / "second", ground_truth_kind="SYNTHETIC",
        k=2, dataset_version="toy-v1", label_version="synthetic-v1",
    )
    assert repeated == summary
    for name in ARTIFACTS:
        assert (tmp_path / "output" / name).read_bytes() == (tmp_path / "second" / name).read_bytes()
    with (tmp_path / "output" / "per_cv.csv").open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    assert len(rows) == 2
    assert rows[0]["retrievedCountAtK"] == "2"
    assert rows[0]["relevantJobCount"] == "2"


def test_k_larger_than_available_and_threshold_is_recorded(tmp_path) -> None:
    summary = _evaluate(tmp_path, k=20, relevance_threshold=2)
    assert summary["config"]["k"] == 20
    assert summary["config"]["relevanceThreshold"] == 2
    assert summary["metrics"]["precisionAtK"] == pytest.approx(2 / 3, abs=1e-6)
    assert summary["metrics"]["recallAtK"] == 1


def test_empty_predictions_and_all_zero_ground_truth_are_valid_queries(tmp_path) -> None:
    dataset = tmp_path / "dataset"
    shutil.copytree(TOY, dataset)
    judgments = dataset / "judgments.csv"
    lines = judgments.read_text(encoding="utf-8").splitlines()
    judgments.write_text(lines[0] + "\n" + "".join(
        line.rsplit(",", 1)[0] + ",0\n" for line in lines[1:]
    ), encoding="utf-8")
    runs = _runs()
    runs[0]["results"] = []
    runs[0]["totalRecommended"] = 0
    source = _write(tmp_path / "empty.json", runs)
    summary = evaluate_predictions(dataset, source, output_directory=tmp_path / "output",
                                   ground_truth_kind="SYNTHETIC")
    assert set(summary["metrics"].values()) == {0}
    with (tmp_path / "output" / "per_cv.csv").open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    assert rows[0]["retrievedCountAtK"] == "0"
    assert rows[0]["relevantJobCount"] == "0"


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda r: r.append(copy.deepcopy(r[0])), "duplicate run"),
        (lambda r: r[0].update(algorithmVersion="bilingual-recommendation-v2"), "V3 algorithm"),
        (lambda r: r[0].update(status="FAILED"), "SUCCESS"),
        (lambda r: r[0].update(totalRecommended=1), "counts"),
        (lambda r: r[0]["results"][0].update(jobId=101), "duplicate predicted"),
        (lambda r: r[0]["results"][0].update(rankPosition=1), "unique and contiguous"),
        (lambda r: r[0]["results"][0].update(rankPosition=4), "unique and contiguous"),
        (lambda r: r[0]["results"][0].pop("rankPosition"), "mixed ranked"),
        (lambda r: r[0]["results"][0].update(tierRankPosition=2), "tier-local"),
        (lambda r: r[0]["results"][0].update(overallScore=1), "FALLBACK"),
        (lambda r: r[0]["results"][1].update(textScore=None), "PRIMARY"),
        (lambda r: r[0]["results"][0].update(rankingTier="UNKNOWN"), "PRIMARY or FALLBACK"),
        (lambda r: r[0]["results"][0].update(rankingScore=True), "finite numeric"),
        (lambda r: r[0]["results"][0].update(rankingScore=1.1), "finite numeric"),
        (lambda r: r[0]["results"][0].update(score=.5), "alias"),
        (lambda r: r[0]["results"][0].update(rankPosition=True), "positive integer"),
    ],
)
def test_invalid_predictions_fail_before_output(tmp_path, mutate, message) -> None:
    runs = _runs()
    mutate(runs)
    with pytest.raises(ValueError, match=message):
        _evaluate(tmp_path, _write(tmp_path / "bad.json", runs))
    assert not (tmp_path / "output").exists()


def test_bad_official_tier_order_and_within_tier_score_order_are_rejected() -> None:
    results = _runs()[0]["results"]
    results[0]["rankPosition"] = 1
    results[2]["rankPosition"] = 3
    with pytest.raises(ValueError, match="PRIMARY before FALLBACK"):
        order_results(results)
    results = _runs()[0]["results"]
    results[1]["rankingScore"] = results[1]["overallScore"] = .9
    with pytest.raises(ValueError, match="descend within"):
        order_results(results)


@pytest.mark.parametrize("payload", ['[{"id":1,"id":2}]', '[{"rankingScore":NaN}]', '[{"rankingScore":Infinity}]', '{}', '[]'])
def test_invalid_json_input_is_rejected(tmp_path, payload) -> None:
    source = tmp_path / "bad.json"
    source.write_text(payload, encoding="utf-8")
    with pytest.raises(ValueError):
        load_predictions(source)


def test_nonfinite_overflow_and_failed_envelope_are_rejected(tmp_path) -> None:
    runs = _runs()
    source = _write(tmp_path / "bad.json", runs)
    source.write_text(source.read_text().replace('"rankingScore": 1.0', '"rankingScore": 1e999'), encoding="utf-8")
    with pytest.raises(ValueError, match="finite numeric"):
        load_predictions(source)
    _write(source, [{"success": False, "data": runs[0]}])
    with pytest.raises(ValueError, match="successful"):
        load_predictions(source)


@pytest.mark.parametrize("mutation", [
    lambda r: r.pop(),
    lambda r: r[0].update(cvId=999),
    lambda r: r[0]["results"][0].update(jobId=999),
    lambda r: r[0].update(totalJobsScanned=7),
])
def test_incomplete_or_misaligned_ground_truth_is_rejected(tmp_path, mutation) -> None:
    runs = _runs()
    mutation(runs)
    with pytest.raises(ValueError):
        _evaluate(tmp_path, _write(tmp_path / "bad.json", runs))
    assert not (tmp_path / "output").exists()


def test_provenance_config_changes_identity_and_manifest_is_hashed(tmp_path) -> None:
    first = _evaluate(tmp_path, k=2)
    second = _evaluate(tmp_path, k=3, relevance_threshold=2)
    manifest = _write(tmp_path / "experiment.json", {"sourceSha": "test-only", "requestLimit": 3})
    third = _evaluate(tmp_path, k=3, relevance_threshold=2, experiment_manifest=manifest)
    assert len({row["evaluationId"] for row in (first, second, third)}) == 3
    assert third["inputSha256"]["experimentManifest"] == hashlib.sha256(manifest.read_bytes()).hexdigest()


def test_fixture_cannot_be_declared_human_and_inputs_cannot_be_overwritten(tmp_path) -> None:
    with pytest.raises(ValueError, match="SYNTHETIC"):
        evaluate_predictions(TOY, PREDICTIONS, output_directory=tmp_path / "output",
                             ground_truth_kind="HUMAN_LABELED")
    source = _write(tmp_path / "predictions.json", _runs())
    original = source.read_bytes()
    with pytest.raises(ValueError, match="overwrite"):
        evaluate_predictions(TOY, source, output_directory=tmp_path, ground_truth_kind="SYNTHETIC")
    assert source.read_bytes() == original


def test_cli_success_and_invalid_evidence_exit_codes(tmp_path, capsys) -> None:
    args = ["--dataset", str(TOY), "--predictions", str(PREDICTIONS),
            "--output-dir", str(tmp_path / "output"), "--ground-truth-kind", "SYNTHETIC"]
    assert main(args) == 0
    args[3] = str(tmp_path / "missing.json")
    assert main(args) == 2
    assert "Prediction evaluation failed" in capsys.readouterr().err
