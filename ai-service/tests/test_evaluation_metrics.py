"""Unit tests for standard-library offline ranking metrics."""

from __future__ import annotations

import math

import pytest

from evaluation.metrics import (
    dcg_at_k,
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


def test_cv_without_relevant_job_fails() -> None:
    with pytest.raises(ValueError, match="at least one relevant Job"):
        recall_at_k([1, 2], {1: 0, 2: 0})


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
