"""Standard-library ranking metrics for one labeled CV corpus."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
import math


def precision_at_k(
    ranked_job_ids: Sequence[int],
    relevance_by_job_id: Mapping[int, int],
    k: int = 5,
    *,
    relevance_threshold: int = 1,
) -> float:
    """Return binary Precision@k over available predictions (labels >= threshold)."""

    validate_relevance_threshold(relevance_threshold)
    ranking = _validate_inputs(ranked_job_ids, relevance_by_job_id, k)
    evaluated_count = min(k, len(ranking))
    if evaluated_count == 0:
        return 0.0
    hits = sum(
        relevance_by_job_id[job_id] >= relevance_threshold
        for job_id in ranking[:evaluated_count]
    )
    return _bounded(hits / evaluated_count)


def recall_at_k(
    ranked_job_ids: Sequence[int],
    relevance_by_job_id: Mapping[int, int],
    k: int = 5,
    *,
    relevance_threshold: int = 1,
) -> float:
    """Return Recall@k over all relevant judgments; zero if none are relevant."""

    validate_relevance_threshold(relevance_threshold)
    ranking = _validate_inputs(ranked_job_ids, relevance_by_job_id, k)
    relevant_count = sum(
        relevance >= relevance_threshold
        for relevance in relevance_by_job_id.values()
    )
    hits = sum(
        relevance_by_job_id[job_id] >= relevance_threshold
        for job_id in ranking[:k]
    )
    return _bounded(hits / relevant_count) if relevant_count else 0.0


def f1_at_k(
    ranked_job_ids: Sequence[int],
    relevance_by_job_id: Mapping[int, int],
    k: int = 5,
    *,
    relevance_threshold: int = 1,
) -> float:
    """Return per-query harmonic mean of Precision@k and Recall@k."""

    precision = precision_at_k(
        ranked_job_ids, relevance_by_job_id, k,
        relevance_threshold=relevance_threshold,
    )
    recall = recall_at_k(
        ranked_job_ids, relevance_by_job_id, k,
        relevance_threshold=relevance_threshold,
    )
    return 2 * precision * recall / (precision + recall) if precision + recall else 0.0


def validate_relevance_threshold(relevance_threshold: int) -> None:
    if type(relevance_threshold) is not int or relevance_threshold not in {1, 2}:
        raise ValueError("relevance_threshold must be 1 or 2 for the 0/1/2 label scale")


def dcg_at_k(
    ranked_job_ids: Sequence[int],
    relevance_by_job_id: Mapping[int, int],
    k: int = 5,
) -> float:
    """Return graded DCG@k using gain 2^relevance - 1."""

    ranking = _validate_inputs(ranked_job_ids, relevance_by_job_id, k)
    return _dcg_from_relevances(
        [relevance_by_job_id[job_id] for job_id in ranking[:k]]
    )


def ndcg_at_k(
    ranked_job_ids: Sequence[int],
    relevance_by_job_id: Mapping[int, int],
    k: int = 5,
) -> float:
    """Return graded NDCG@k using the ideal ordering as denominator."""

    ranking = _validate_inputs(ranked_job_ids, relevance_by_job_id, k)
    actual = _dcg_from_relevances(
        [relevance_by_job_id[job_id] for job_id in ranking[:k]]
    )
    ideal = _dcg_from_relevances(
        sorted(relevance_by_job_id.values(), reverse=True)[:k]
    )
    return _bounded(actual / ideal) if ideal else 0.0


def _dcg_from_relevances(relevances: Sequence[int]) -> float:
    return sum(
        ((2**relevance) - 1) / math.log2(rank + 1)
        for rank, relevance in enumerate(relevances, start=1)
    )


def _validate_inputs(
    ranked_job_ids: Sequence[int],
    relevance_by_job_id: Mapping[int, int],
    k: int,
) -> tuple[int, ...]:
    if type(k) is not int or k <= 0:
        raise ValueError("k must be a positive integer")
    if isinstance(ranked_job_ids, (str, bytes)):
        raise ValueError("ranked_job_ids must be a sequence of Job IDs")

    ranking = tuple(ranked_job_ids)
    seen_job_ids: set[int] = set()
    for index, job_id in enumerate(ranking):
        if type(job_id) is not int or job_id <= 0:
            raise ValueError(
                f"ranked_job_ids[{index}] must be a positive integer"
            )
        if job_id in seen_job_ids:
            raise ValueError(
                f"ranked_job_ids contains duplicate Job ID {job_id}"
            )
        if job_id not in relevance_by_job_id:
            raise ValueError(
                f"ranked Job ID {job_id} has no relevance judgment"
            )
        seen_job_ids.add(job_id)

    if not relevance_by_job_id:
        raise ValueError("relevance judgments must not be empty")
    for job_id, relevance in relevance_by_job_id.items():
        if type(job_id) is not int or job_id <= 0:
            raise ValueError(
                "relevance judgment Job IDs must be positive integers"
            )
        if type(relevance) is not int or relevance not in {0, 1, 2}:
            raise ValueError(
                f"relevance for Job ID {job_id} must be 0, 1, or 2"
            )
    return ranking


def _bounded(value: float) -> float:
    if value < 0.0 or value > 1.0:
        raise RuntimeError(f"normalized metric is outside [0, 1]: {value}")
    return value
