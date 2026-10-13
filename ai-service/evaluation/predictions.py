"""Offline adapter for saved Student V3 public run details; never calls scoring."""

from __future__ import annotations

from datetime import datetime
import math
from pathlib import Path

from .dataset import DatasetValidationError, _read_json, _require_positive_json_id


ALGORITHM = "tfidf-cosine-hybrid"
ALGORITHM_VERSION = "bilingual-recommendation-v3"
RESULT_FIELDS = (
    "jobId", "rankPosition", "tierRankPosition", "rankingTier",
    "rankingScore", "textScore", "skillScore", "overallScore", "scoringStrategy",
)


def load_predictions(
    path: str | Path, *, allow_unranked: bool = False,
) -> tuple[dict[str, object], ...]:
    """Read an array of public data objects or successful ApiResponse envelopes."""

    document = _read_json(Path(path))
    if type(document) is not list or not document:
        raise DatasetValidationError("predictions must be a non-empty array of run details")
    runs = []
    seen_runs: set[int] = set()
    seen_cvs: set[int] = set()
    for value in document:
        if type(value) is not dict:
            raise DatasetValidationError("each prediction run must be an object")
        if "success" in value:
            if value["success"] is not True or value.get("errorCode") is not None:
                raise DatasetValidationError("prediction ApiResponse must be successful")
            value = value.get("data")
        if type(value) is not dict:
            raise DatasetValidationError("prediction data must be a run detail object")
        run_id = _require_positive_json_id(value.get("id"), "run.id")
        cv_id = _require_positive_json_id(value.get("cvId"), "run.cvId")
        if run_id in seen_runs or cv_id in seen_cvs:
            raise DatasetValidationError("duplicate run id or cvId; select one run per CV")
        seen_runs.add(run_id)
        seen_cvs.add(cv_id)
        if value.get("status") != "SUCCESS" or value.get("sourceType") != "CV":
            raise DatasetValidationError("only SUCCESS Student CV runs can be evaluated")
        if value.get("algorithm") != ALGORITHM or value.get("algorithmVersion") != ALGORITHM_VERSION:
            raise DatasetValidationError("prediction run must use current Student V3 algorithm/version")
        results = value.get("results")
        if type(results) is not list or len(results) > 100:
            raise DatasetValidationError("run.results must be an array of at most 100 results")
        for field in ("totalRecommended", "totalJobsScanned"):
            count = value.get(field)
            if type(count) is not int or count < 0:
                raise DatasetValidationError(f"run.{field} must be a nonnegative integer")
        if value["totalRecommended"] != len(results) or value["totalJobsScanned"] < len(results):
            raise DatasetValidationError("prediction counts do not match results")
        ordered, order_source = order_results(results, allow_unranked=allow_unranked)
        run = {
            "id": run_id, "cvId": cv_id, "sourceType": "CV", "status": "SUCCESS",
            "algorithm": ALGORITHM, "algorithmVersion": ALGORITHM_VERSION,
            "totalJobsScanned": value["totalJobsScanned"],
            "totalRecommended": len(ordered),
            "results": ordered,
        }
        for field in ("startedAt", "finishedAt", "createdAt"):
            timestamp = value.get(field)
            if timestamp is not None:
                if type(timestamp) is not str or len(timestamp) > 64:
                    raise DatasetValidationError(f"run.{field} must be an ISO timestamp")
                try:
                    datetime.fromisoformat(timestamp)
                except ValueError as error:
                    raise DatasetValidationError(f"run.{field} must be an ISO timestamp") from error
            run[field] = timestamp
        # Kept separately from the sanitized public-shaped export.
        runs.append({"run": run, "orderSource": order_source})
    return tuple(sorted(runs, key=lambda entry: entry["run"]["cvId"]))


def order_results(
    results: list[dict[str, object]], *, allow_unranked: bool = False,
) -> tuple[list[dict[str, object]], str]:
    """Prefer official global ranks; opt-in reconstruction uses exact V3 tier order."""

    normalized = []
    seen_jobs: set[int] = set()
    for result in results:
        if type(result) is not dict:
            raise DatasetValidationError("prediction result must be an object")
        required = set(RESULT_FIELDS) - {"rankPosition", "tierRankPosition"}
        if required - set(result):
            raise DatasetValidationError("prediction result is missing required V3 fields")
        job_id = _require_positive_json_id(result["jobId"], "result.jobId")
        if job_id in seen_jobs:
            raise DatasetValidationError("duplicate predicted jobId")
        seen_jobs.add(job_id)
        tier = result["rankingTier"]
        if tier not in ("PRIMARY", "FALLBACK"):
            raise DatasetValidationError("rankingTier must be PRIMARY or FALLBACK")
        for field in ("rankingScore", "skillScore", "textScore", "overallScore"):
            _validate_score(result[field], field, nullable=field in ("textScore", "overallScore"))
        if "score" in result:
            _validate_score(result["score"], "score")
            if result["score"] != result["rankingScore"]:
                raise DatasetValidationError("deprecated score alias disagrees with rankingScore")
        if tier == "PRIMARY":
            if (result["scoringStrategy"] != "SAME_LANGUAGE_HYBRID"
                    or result["textScore"] is None or result["overallScore"] is None
                    or result["rankingScore"] != result["overallScore"]):
                raise DatasetValidationError("invalid PRIMARY score/strategy semantics")
        elif (result["scoringStrategy"] != "CROSS_LANGUAGE_SKILL_BASED"
              or result["textScore"] is not None or result["overallScore"] is not None
              or result["rankingScore"] != result["skillScore"]):
            raise DatasetValidationError("invalid FALLBACK score/strategy semantics")
        for field in ("rankPosition", "tierRankPosition"):
            if result.get(field) is not None:
                _require_positive_json_id(result[field], f"result.{field}")
        normalized.append({field: result.get(field) for field in RESULT_FIELDS})

    if not normalized:
        return [], "rankPosition"
    ranked_count = sum(row["rankPosition"] is not None for row in normalized)
    if 0 < ranked_count < len(normalized):
        raise DatasetValidationError("mixed ranked/unranked results are invalid")
    if ranked_count:
        normalized.sort(key=lambda row: row["rankPosition"])
        if [row["rankPosition"] for row in normalized] != list(range(1, len(normalized) + 1)):
            raise DatasetValidationError("rankPosition must be unique and contiguous from 1")
        order_source = "rankPosition"
    else:
        if not allow_unranked:
            raise DatasetValidationError("rankPosition required; exact unranked inputs need --allow-unranked")
        normalized.sort(key=lambda row: (
            0 if row["rankingTier"] == "PRIMARY" else 1,
            -row["rankingScore"], row["jobId"],
        ))
        order_source = "reconstructed_v3_order"

    tier_counts = {"PRIMARY": 0, "FALLBACK": 0}
    previous_score = {"PRIMARY": None, "FALLBACK": None}
    fallback_seen = False
    for row in normalized:
        tier = row["rankingTier"]
        if tier == "PRIMARY" and fallback_seen:
            raise DatasetValidationError("official V3 order requires PRIMARY before FALLBACK")
        fallback_seen |= tier == "FALLBACK"
        tier_counts[tier] += 1
        tier_rank = row["tierRankPosition"]
        if (ranked_count and tier_rank is None) or (
            tier_rank is not None and tier_rank != tier_counts[tier]
        ):
            raise DatasetValidationError("tierRankPosition must match tier-local order")
        score = row["rankingScore"]
        if previous_score[tier] is not None and score > previous_score[tier]:
            raise DatasetValidationError("rankingScore must descend within each tier")
        previous_score[tier] = score
    # Never re-sort persisted score ties: Backend ranks before five-decimal rounding.
    return normalized, order_source


def _validate_score(value: object, field: str, *, nullable: bool = False) -> None:
    if nullable and value is None:
        return
    if type(value) not in (int, float) or not 0 <= value <= 1 or not math.isfinite(value):
        raise DatasetValidationError(f"{field} must be a finite numeric score in [0,1]")
