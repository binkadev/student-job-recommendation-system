"""Strict contract tests for Company Candidate Ranking V3."""

from copy import deepcopy
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

from v3.candidate_ranking_schemas import (
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    CandidateRankingRequest,
    CandidateRankingResponse,
    CandidateRankingResult,
)
from v3.constants import ALGORITHM, PROCESSING_VERSION


REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"


def valid_request() -> dict:
    return {
        "requestId": REQUEST_ID,
        "job": {
            "id": 10,
            "text": "TITLE:\nBackend Intern\nDESCRIPTION:\nBuild software services.",
            "skills": ["java", "spring boot"],
        },
        "candidates": [
            {
                "applicationId": 300,
                "cvId": 55,
                "processedText": "java spring_boot rest_api",
                "skills": ["java", "spring boot"],
                "languageCode": "en",
                "languageConfidence": 0.9821,
                "processingVersion": PROCESSING_VERSION,
            }
        ],
        "threshold": 0.1,
        "primaryLimit": 20,
        "fallbackLimit": 20,
    }


def primary_result() -> dict:
    return {
        "applicationId": 300,
        "cvId": 55,
        "rankingTier": "PRIMARY",
        "rankingScore": 0.72,
        "overallScore": 0.72,
        "textScore": 0.65,
        "skillScore": 0.85,
        "scoringStrategy": "SAME_LANGUAGE_HYBRID",
        "matchedSkills": ["java"],
        "missingSkills": ["spring boot"],
    }


def fallback_result() -> dict:
    return {
        "applicationId": 301,
        "cvId": 56,
        "rankingTier": "FALLBACK",
        "rankingScore": 1.0,
        "overallScore": None,
        "textScore": None,
        "skillScore": 1.0,
        "scoringStrategy": "CROSS_LANGUAGE_SKILL_BASED",
        "matchedSkills": ["java"],
        "missingSkills": [],
    }


def test_valid_request_is_strict_and_preserves_processed_text_verbatim() -> None:
    payload = valid_request()
    payload["candidates"][0]["processedText"] = "  java spring_boot  \n"

    request = CandidateRankingRequest.model_validate(payload)

    assert request.requestId == UUID(REQUEST_ID)
    assert request.threshold == Decimal("0.1")
    assert request.candidates[0].processedText == "  java spring_boot  \n"


@pytest.mark.parametrize(
    ("primary_limit", "fallback_limit"),
    [(100, 0), (0, 100), (50, 50), (1, 0), (0, 1)],
)
def test_valid_independent_limit_boundaries(
    primary_limit: int,
    fallback_limit: int,
) -> None:
    payload = valid_request()
    payload["primaryLimit"] = primary_limit
    payload["fallbackLimit"] = fallback_limit
    payload["threshold"] = 0

    request = CandidateRankingRequest.model_validate(payload)

    assert request.primaryLimit + request.fallbackLimit in range(1, 101)
    assert request.threshold == Decimal("0")


@pytest.mark.parametrize(
    "mutate",
    [
        lambda payload: payload.update({"limit": 20}),
        lambda payload: payload.update({"unknown": True}),
        lambda payload: payload["job"].update({"unknown": True}),
        lambda payload: payload["candidates"][0].update({"rawText": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"extractedText": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"name": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"email": "x@example.com"}),
        lambda payload: payload["candidates"][0].update({"phone": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"coverLetter": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"filePath": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"fileUrl": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"studentProfileText": "forbidden"}),
        lambda payload: payload["candidates"][0].update({"studentSkills": []}),
    ],
)
def test_legacy_unknown_and_candidate_private_fields_are_rejected(mutate) -> None:
    payload = valid_request()
    mutate(payload)

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


def test_duplicate_application_ids_are_rejected() -> None:
    payload = valid_request()
    duplicate = deepcopy(payload["candidates"][0])
    duplicate["cvId"] = 56
    payload["candidates"].append(duplicate)

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize(
    ("path", "invalid"),
    [
        (("job", "id"), True),
        (("job", "id"), 0),
        (("candidates", 0, "applicationId"), -1),
        (("candidates", 0, "applicationId"), "300"),
        (("candidates", 0, "cvId"), 55.0),
    ],
)
def test_ids_are_strict_positive_integers(path, invalid) -> None:
    payload = valid_request()
    target = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = invalid

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("processed_text", ["", " \t\r\n "])
def test_processed_text_must_be_nonblank(processed_text: str) -> None:
    payload = valid_request()
    payload["candidates"][0]["processedText"] = processed_text

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


def test_incompatible_processing_version_is_rejected() -> None:
    payload = valid_request()
    payload["candidates"][0]["processingVersion"] = "bilingual-nlp-v3"

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize(
    "confidence",
    [True, False, -0.000001, 1.000001, "0.9", float("nan"), float("inf")],
)
def test_language_confidence_must_be_finite_numeric_and_bounded(confidence) -> None:
    payload = valid_request()
    payload["candidates"][0]["languageConfidence"] = confidence

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize(
    "threshold",
    [True, False, -0.000001, 1.000001, "0.1", float("nan"), float("inf")],
)
def test_threshold_must_be_finite_numeric_and_bounded(threshold) -> None:
    payload = valid_request()
    payload["threshold"] = threshold

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("field", ["primaryLimit", "fallbackLimit"])
@pytest.mark.parametrize("invalid", [-1, 101, True, False, 1.0, "20"])
def test_tier_limits_are_strict_bounded_integers(field: str, invalid) -> None:
    payload = valid_request()
    payload[field] = invalid

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("limits", [(0, 0), (100, 1), (1, 100), (60, 60)])
def test_combined_limit_must_be_between_one_and_one_hundred(limits) -> None:
    payload = valid_request()
    payload["primaryLimit"], payload["fallbackLimit"] = limits

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


def test_exact_metadata_and_valid_primary_fallback_results() -> None:
    response = CandidateRankingResponse.model_validate(
        {
            "requestId": REQUEST_ID,
            "algorithm": ALGORITHM,
            "algorithmVersion": CANDIDATE_RANKING_ALGORITHM_VERSION,
            "results": [primary_result(), fallback_result()],
        }
    )

    assert response.algorithm == "tfidf-cosine-hybrid"
    assert response.algorithmVersion == "bilingual-candidate-ranking-v3"


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
        CandidateRankingResult.model_validate(result)


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
        CandidateRankingResult.model_validate(result)


@pytest.mark.parametrize(
    "forbidden_field",
    ["score", "rank", "rankPosition", "tierRankPosition"],
)
def test_score_and_rank_fields_are_forbidden(forbidden_field: str) -> None:
    result = primary_result()
    result[forbidden_field] = 1

    with pytest.raises(ValidationError):
        CandidateRankingResult.model_validate(result)


def test_duplicate_response_application_ids_are_rejected() -> None:
    duplicate = primary_result()
    duplicate["cvId"] = 99

    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(
            {
                "requestId": REQUEST_ID,
                "algorithm": ALGORITHM,
                "algorithmVersion": CANDIDATE_RANKING_ALGORITHM_VERSION,
                "results": [primary_result(), duplicate],
            }
        )


def test_result_scores_reject_more_than_eight_decimal_places() -> None:
    result = primary_result()
    result["rankingScore"] = 0.123456789
    result["overallScore"] = 0.123456789

    with pytest.raises(ValidationError):
        CandidateRankingResult.model_validate(result)
