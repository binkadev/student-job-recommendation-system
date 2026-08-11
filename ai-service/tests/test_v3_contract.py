"""Strict contract tests for Student Recommendation V3."""

from copy import deepcopy
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

from v3.constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION
from v3.schemas import (
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)


REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"


def valid_request() -> dict:
    return {
        "requestId": REQUEST_ID,
        "cv": {
            "id": 55,
            "processedText": "java spring_boot rest_api postgresql",
            "skills": ["java", "spring boot"],
            "languageCode": "vi",
            "languageConfidence": 0.9821,
            "processingVersion": PROCESSING_VERSION,
        },
        "jobs": [
            {
                "id": 10,
                "text": "TITLE:\nBackend Intern\nDESCRIPTION:\nChúng tôi phát triển phần mềm.",
                "skills": ["java", "spring boot"],
            }
        ],
        "threshold": 0.1,
        "limit": 20,
    }


def primary_result() -> dict:
    return {
        "jobId": 10,
        "rankingTier": "PRIMARY",
        "rankingScore": 0.72,
        "overallScore": 0.72,
        "textScore": 0.65,
        "skillScore": 0.85,
        "scoringStrategy": "SAME_LANGUAGE_HYBRID",
        "matchedSkills": ["java"],
        "missingSkills": ["spring boot"],
        "reason": "Same-language evidence was used.",
    }


def fallback_result() -> dict:
    return {
        "jobId": 11,
        "rankingTier": "FALLBACK",
        "rankingScore": 1.0,
        "overallScore": None,
        "textScore": None,
        "skillScore": 1.0,
        "scoringStrategy": "CROSS_LANGUAGE_SKILL_BASED",
        "matchedSkills": ["java"],
        "missingSkills": [],
        "reason": "Skill-only canonical Job-skill coverage was used.",
    }


def test_valid_strict_request_preserves_processed_text_verbatim() -> None:
    payload = valid_request()
    payload["cv"]["processedText"] = "  java spring_boot  \n"

    request = RecommendationRequest.model_validate(payload)

    assert request.requestId == UUID(REQUEST_ID)
    assert request.cv.processedText == "  java spring_boot  \n"
    assert request.threshold == Decimal("0.1")
    assert request.limit == 20


@pytest.mark.parametrize(
    "mutate",
    [
        lambda payload: payload.update({"unknown": True}),
        lambda payload: payload["cv"].update({"rawText": "forbidden"}),
        lambda payload: payload["cv"].update({"extractedText": "forbidden"}),
        lambda payload: payload["cv"].update({"email": "forbidden@example.com"}),
        lambda payload: payload["jobs"][0].update({"unknown": True}),
    ],
)
def test_unknown_and_forbidden_fields_are_rejected(mutate) -> None:
    payload = valid_request()
    mutate(payload)

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_duplicate_job_ids_are_rejected() -> None:
    payload = valid_request()
    payload["jobs"].append(deepcopy(payload["jobs"][0]))

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize(
    ("path", "invalid"),
    [
        (("cv", "id"), True),
        (("cv", "id"), 0),
        (("cv", "id"), "55"),
        (("jobs", 0, "id"), -1),
        (("jobs", 0, "id"), 10.0),
    ],
)
def test_ids_are_strict_positive_integers(path, invalid) -> None:
    payload = valid_request()
    target = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = invalid

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize(
    "threshold",
    [True, False, -0.000001, 1.000001, "0.1", float("nan"), float("inf")],
)
def test_threshold_must_be_finite_numeric_and_bounded(threshold) -> None:
    payload = valid_request()
    payload["threshold"] = threshold

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize("limit", [True, False, 0, 101, -1, 1.0, "20"])
def test_limit_is_a_strict_integer_from_one_to_one_hundred(limit) -> None:
    payload = valid_request()
    payload["limit"] = limit

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize("processed_text", ["", " \t\r\n "])
def test_processed_text_must_be_nonblank(processed_text: str) -> None:
    payload = valid_request()
    payload["cv"]["processedText"] = processed_text

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize(
    "confidence",
    [True, False, -0.000001, 1.000001, "0.9", float("nan"), float("inf")],
)
def test_language_confidence_must_be_finite_numeric_and_bounded(confidence) -> None:
    payload = valid_request()
    payload["cv"]["languageConfidence"] = confidence

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_incompatible_processing_version_is_rejected() -> None:
    payload = valid_request()
    payload["cv"]["processingVersion"] = "bilingual-nlp-v3"

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_exact_v3_metadata_and_primary_fallback_results_are_valid() -> None:
    response = RecommendationResponse.model_validate(
        {
            "requestId": REQUEST_ID,
            "algorithm": ALGORITHM,
            "algorithmVersion": ALGORITHM_VERSION,
            "results": [primary_result(), fallback_result()],
        }
    )

    assert response.algorithm == "tfidf-cosine-hybrid"
    assert response.algorithmVersion == "bilingual-recommendation-v3"


def test_result_scores_reject_more_than_eight_decimal_places() -> None:
    result = primary_result()
    result["rankingScore"] = 0.123456789
    result["overallScore"] = 0.123456789

    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda result: result.update({"scoringStrategy": "CROSS_LANGUAGE_SKILL_BASED"}),
        lambda result: result.update({"textScore": None}),
        lambda result: result.update({"overallScore": None}),
        lambda result: result.update({"rankingScore": 0.71}),
    ],
)
def test_primary_semantic_invariants_are_enforced(mutate) -> None:
    result = primary_result()
    mutate(result)

    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda result: result.update({"scoringStrategy": "SAME_LANGUAGE_HYBRID"}),
        lambda result: result.update({"textScore": 0.5}),
        lambda result: result.update({"overallScore": 1.0}),
        lambda result: result.update({"rankingScore": 0.5}),
    ],
)
def test_fallback_semantic_invariants_are_enforced(mutate) -> None:
    result = fallback_result()
    mutate(result)

    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result)


@pytest.mark.parametrize(
    "forbidden_field",
    ["score", "rank", "rankPosition", "tierRankPosition"],
)
def test_score_and_rank_fields_are_forbidden(forbidden_field: str) -> None:
    result = primary_result()
    result[forbidden_field] = 1

    with pytest.raises(ValidationError):
        RecommendationResult.model_validate(result)
