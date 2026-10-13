"""Unit tests for standard-library offline ranking metrics."""

from __future__ import annotations

import math

import pytest

from evaluation.metrics import (
    dcg_at_k,
    f1_at_k,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
)


def test_perfect_ranking_has_perfect_normalized_metrics() -> None:
    judgments = {1: 2, 2: 1, 3: 0}
    ranking = [1, 2, 3]

    assert precision_at_k(ranking, judgments, 2) == 1.0
    assert recall_at_k(ranking, judgments, 2) == 1.0
    assert ndcg_at_k(ranking, judgments, 3) == 1.0
    assert dcg_at_k(ranking, judgments, 3) == pytest.approx(
        3 + (1 / math.log2(3))
    )


def test_reversed_ranking_is_worse_than_perfect_ranking() -> None:
    judgments = {1: 2, 2: 1, 3: 0}

    reversed_ndcg = ndcg_at_k([3, 2, 1], judgments, 3)

    assert 0.0 < reversed_ndcg < 1.0


def test_no_hit_in_top_k_returns_zero() -> None:
    judgments = {1: 2, 2: 1, 3: 0}
    ranking = [3, 1, 2]

    assert precision_at_k(ranking, judgments, 1) == 0.0
    assert recall_at_k(ranking, judgments, 1) == 0.0
    assert ndcg_at_k(ranking, judgments, 1) == 0.0


def test_k_larger_than_job_count_uses_available_jobs() -> None:
    judgments = {1: 2, 2: 1}
    ranking = [1, 2]

    assert precision_at_k(ranking, judgments, 5) == 1.0
    assert recall_at_k(ranking, judgments, 5) == 1.0
    assert ndcg_at_k(ranking, judgments, 5) == 1.0


def test_ndcg_uses_graded_relevance() -> None:
    judgments = {1: 2, 2: 1}
    lower_grade_first = ndcg_at_k([2, 1], judgments, 2)
    expected = (
        1 + (3 / math.log2(3))
    ) / (
        3 + (1 / math.log2(3))
    )

    assert lower_grade_first == pytest.approx(expected)
    assert lower_grade_first < ndcg_at_k([1, 2], judgments, 2)


@pytest.mark.parametrize("invalid_relevance", [-1, 3, 1.0, True])
def test_invalid_relevance_fails(invalid_relevance: object) -> None:
    with pytest.raises(ValueError, match="must be 0, 1, or 2"):
        precision_at_k([1], {1: invalid_relevance})  # type: ignore[dict-item]


def test_cv_without_relevant_job_returns_defined_zero_metrics() -> None:
    for metric in (precision_at_k, recall_at_k, f1_at_k, ndcg_at_k):
        assert metric([1, 2], {1: 0, 2: 0}) == 0.0


@pytest.mark.parametrize(
    ("ranking", "k", "expected"),
    [
        ([1, 2], 2, (1, 1, 1)),
        ([3], 5, (0, 0, 0)),
        ([1, 3], 2, (.5, .5, .5)),
        ([1, 3, 2], 1, (1, .5, 2 / 3)),
        ([1], 10, (1, .5, 2 / 3)),
        ([], 5, (0, 0, 0)),
    ],
)
def test_binary_metrics_and_f1_boundaries(ranking, k, expected) -> None:
    labels = {1: 2, 2: 1, 3: 0}
    assert tuple(metric(ranking, labels, k) for metric in (
        precision_at_k, recall_at_k, f1_at_k,
    )) == pytest.approx(expected)


def test_threshold_changes_binary_metrics_but_not_graded_ndcg() -> None:
    labels = {1: 2, 2: 1, 3: 0}
    for metric in (precision_at_k, recall_at_k, f1_at_k):
        assert metric([2], labels, 1, relevance_threshold=1) > 0
        assert metric([2], labels, 1, relevance_threshold=2) == 0
        assert metric([2], {2: 1}, 1, relevance_threshold=2) == 0
    assert ndcg_at_k([2], {2: 1}, 1) == 1  # Graded gain remains positive.
    assert ndcg_at_k([], labels, 5) == 0


@pytest.mark.parametrize("threshold", [0, 3, True, 1.0, "1"])
def test_invalid_binary_threshold_is_rejected(threshold) -> None:
    for metric in (precision_at_k, recall_at_k, f1_at_k):
        with pytest.raises(ValueError, match="relevance_threshold"):
            metric([1], {1: 2}, relevance_threshold=threshold)


@pytest.mark.parametrize("k", [0, -1, True, 1.5])
def test_invalid_k_is_rejected(k) -> None:
    for metric in (precision_at_k, recall_at_k, f1_at_k, ndcg_at_k):
        with pytest.raises(ValueError, match="positive integer"):
            metric([1], {1: 2}, k)


@pytest.mark.parametrize(
    ("ranking", "labels", "message"),
    [
        ([1, 1], {1: 2}, "duplicate"),
        ([1, 2], {1: 2}, "no relevance judgment"),
        ([0], {1: 2}, "positive integer"),
        ([True], {1: 2}, "positive integer"),
        ([], {}, "must not be empty"),
        ([1], {1: 2, 2: 3}, "0, 1, or 2"),
    ],
)
def test_invalid_inputs_fail_even_outside_cutoff(ranking, labels, message) -> None:
    for metric in (precision_at_k, recall_at_k, f1_at_k, ndcg_at_k):
        with pytest.raises(ValueError, match=message):
            metric(ranking, labels, 1)


def test_metric_results_are_deterministic_and_bounded() -> None:
    judgments = {1: 2, 2: 0, 3: 1, 4: 0}
    ranking = [3, 2, 1, 4]

    first = (
        precision_at_k(ranking, judgments),
        recall_at_k(ranking, judgments),
        ndcg_at_k(ranking, judgments),
    )
    second = (
        precision_at_k(ranking, judgments),
        recall_at_k(ranking, judgments),
        ndcg_at_k(ranking, judgments),
    )

    assert first == second
    assert all(0.0 <= metric <= 1.0 for metric in first)
