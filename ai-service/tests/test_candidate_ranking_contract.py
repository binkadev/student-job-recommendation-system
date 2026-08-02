"""Focused contract/configuration tests for candidate ranking foundation."""

from copy import deepcopy
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

import main
from v2.api import V2ConfigurationError, build_v2_runtime
from v2.candidate_ranking_schemas import (
    CandidateRankingRequest,
    CandidateRankingResponse,
)
from v2.constants import (
    ALGORITHM,
    ALGORITHM_VERSION,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
)
from v2.http_errors import candidate_ranking_capacity_exceeded_error, error_response


REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"
TEST_INTERNAL_API_KEY = "test-ai-internal-api-key-at-least-32-characters"


def valid_request() -> dict:
    return {
        "requestId": REQUEST_ID,
        "job": {
            "id": 10,
            "text": "TITLE:\nBackend Intern",
            "skills": ["docker", "java", "spring boot"],
        },
        "candidates": [
            {
                "applicationId": 300,
                "cvId": 55,
                "text": "Persisted extracted CV text",
                "skills": ["java", "spring boot"],
            }
        ],
        "threshold": 0.1,
        "limit": 20,
    }


def valid_result() -> dict:
    return {
        "applicationId": 300,
        "cvId": 55,
        "score": 0.72,
        "textScore": 0.65,
        "skillScore": 0.85,
        "scoringStrategy": "SAME_LANGUAGE_HYBRID",
        "matchedSkills": ["java"],
        "missingSkills": ["docker", "spring boot"],
    }


def valid_response() -> dict:
    return {
        "requestId": REQUEST_ID,
        "algorithm": ALGORITHM,
        "algorithmVersion": CANDIDATE_RANKING_ALGORITHM_VERSION,
        "results": [valid_result()],
    }


def test_valid_backend_shaped_request_and_uuid_are_strictly_parsed() -> None:
    request = CandidateRankingRequest.model_validate(valid_request())

    assert request.requestId == UUID(REQUEST_ID)
    assert request.threshold == Decimal("0.1")
    assert request.limit == 20


@pytest.mark.parametrize("field_path", [("job", "id"), ("candidates", 0, "applicationId"), ("candidates", 0, "cvId")])
@pytest.mark.parametrize("invalid_id", [True, False, 0, -1, "1", 1.0])
def test_ids_are_strict_positive_integers_and_reject_bools(field_path, invalid_id) -> None:
    payload = valid_request()
    target = payload
    for key in field_path[:-1]:
        target = target[key]
    target[field_path[-1]] = invalid_id

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("field_path", [("job", "text"), ("candidates", 0, "text")])
@pytest.mark.parametrize(
    "invalid_text",
    ["", " \t\r\n ", "x" * 1_000_001],
    ids=["empty", "whitespace", "too_long"],
)
def test_text_is_nonblank_and_bounded(field_path, invalid_text) -> None:
    payload = valid_request()
    target = payload
    for key in field_path[:-1]:
        target = target[key]
    target[field_path[-1]] = invalid_text

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("threshold", [0, 1, 0.0, 1.0])
def test_threshold_boundaries_are_accepted(threshold) -> None:
    payload = valid_request()
    payload["threshold"] = threshold

    CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("threshold", [True, False, -0.000001, 1.000001, "0.1", "NaN", "Infinity"])
def test_threshold_must_be_finite_numeric_and_bounded(threshold) -> None:
    payload = valid_request()
    payload["threshold"] = threshold

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("limit", [1, 100])
def test_limit_boundaries_are_accepted(limit) -> None:
    payload = valid_request()
    payload["limit"] = limit

    CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("limit", [True, False, 0, 101, -1, "+1", "1.0", 1.0])
def test_limit_is_a_strict_integer_from_one_to_one_hundred(limit) -> None:
    payload = valid_request()
    payload["limit"] = limit

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


def test_candidates_are_nonempty_application_ids_unique_and_cv_ids_may_repeat() -> None:
    empty = valid_request()
    empty["candidates"] = []
    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(empty)

    repeated_cv = valid_request()
    repeated_cv["candidates"].append(
        {
            "applicationId": 301,
            "cvId": 55,
            "text": "Another persisted CV text",
            "skills": [],
        }
    )
    CandidateRankingRequest.model_validate(repeated_cv)

    duplicate_application = deepcopy(repeated_cv)
    duplicate_application["candidates"][1]["applicationId"] = 300
    with pytest.raises(ValidationError, match="Application IDs must be unique"):
        CandidateRankingRequest.model_validate(duplicate_application)


@pytest.mark.parametrize(
    ("model_factory", "field_path"),
    [
        (valid_request, ()),
        (valid_request, ("job",)),
        (valid_request, ("candidates", 0)),
    ],
)
def test_unknown_fields_are_rejected_at_request_job_and_candidate_levels(
    model_factory,
    field_path,
) -> None:
    payload = model_factory()
    target = payload
    for key in field_path:
        target = target[key]
    target["unexpected"] = True

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


def test_unknown_fields_are_rejected_at_response_and_result_levels() -> None:
    root = valid_response()
    root["unexpected"] = True
    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(root)

    result = valid_response()
    result["results"][0]["unexpected"] = True
    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(result)


def test_duplicate_response_application_ids_are_rejected() -> None:
    payload = valid_response()
    duplicate = deepcopy(payload["results"][0])
    duplicate["cvId"] = 56
    payload["results"].append(duplicate)

    with pytest.raises(ValidationError, match="Application IDs must be unique"):
        CandidateRankingResponse.model_validate(payload)


def test_repeated_result_cv_ids_alone_are_allowed() -> None:
    payload = valid_response()
    repeated_cv = deepcopy(payload["results"][0])
    repeated_cv["applicationId"] = 301
    payload["results"].append(repeated_cv)

    CandidateRankingResponse.model_validate(payload)


@pytest.mark.parametrize("field_name", ["score", "textScore", "skillScore"])
def test_candidate_scores_accept_at_most_eight_decimal_places(field_name) -> None:
    payload = valid_response()
    payload["results"][0][field_name] = 0.12345678

    CandidateRankingResponse.model_validate(payload)


@pytest.mark.parametrize("field_name", ["score", "textScore", "skillScore"])
def test_candidate_scores_reject_more_than_eight_decimal_places(field_name) -> None:
    payload = valid_response()
    payload["results"][0][field_name] = 0.123456789

    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(payload)


def test_cross_language_null_text_score_remains_valid() -> None:
    payload = valid_response()
    payload["results"][0]["scoringStrategy"] = "CROSS_LANGUAGE_SKILL_BASED"
    payload["results"][0]["textScore"] = None

    CandidateRankingResponse.model_validate(payload)


@pytest.mark.parametrize(
    ("strategy", "text_score"),
    [
        ("SAME_LANGUAGE_HYBRID", None),
        ("CROSS_LANGUAGE_SKILL_BASED", 0.65),
    ],
)
def test_strategy_and_text_score_consistency(strategy, text_score) -> None:
    payload = valid_response()
    payload["results"][0]["scoringStrategy"] = strategy
    payload["results"][0]["textScore"] = text_score

    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(payload)


@pytest.mark.parametrize("forbidden_field", ["rank", "rankPosition", "reason", "studentId", "studentName", "filePath"])
def test_candidate_ranking_schema_has_no_rank_reason_identity_or_storage_fields(forbidden_field) -> None:
    schema = CandidateRankingResponse.model_json_schema()
    result_properties = schema["$defs"]["CandidateRankingResult"]["properties"]
    assert forbidden_field not in result_properties

    payload = valid_response()
    payload["results"][0][forbidden_field] = "must be rejected"
    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(payload)


def test_candidate_count_has_no_schema_maximum() -> None:
    schema = CandidateRankingRequest.model_json_schema()
    candidates = schema["properties"]["candidates"]

    assert candidates["minItems"] == 1
    assert "maxItems" not in candidates


def test_candidate_ranking_metadata_is_exact_and_recommendation_metadata_unchanged() -> None:
    assert ALGORITHM == "tfidf-cosine-hybrid"
    assert ALGORITHM_VERSION == "bilingual-recommendation-v2"
    assert CANDIDATE_RANKING_ALGORITHM_VERSION == "bilingual-candidate-ranking-v2"

    response = CandidateRankingResponse.model_validate(valid_response())
    assert response.algorithm == "tfidf-cosine-hybrid"
    assert response.algorithmVersion == "bilingual-candidate-ranking-v2"

    wrong = valid_response()
    wrong["algorithmVersion"] = ALGORITHM_VERSION
    with pytest.raises(ValidationError):
        CandidateRankingResponse.model_validate(wrong)


def _runtime_environment(**overrides: str) -> dict[str, str]:
    return {
        "AI_INTERNAL_API_KEY": TEST_INTERNAL_API_KEY,
        **overrides,
    }


def test_candidate_ranking_config_defaults() -> None:
    runtime = build_v2_runtime(
        environment=_runtime_environment(),
        catalog_loader=lambda: main.v2_runtime.catalog,
    )

    assert runtime.max_candidate_ranking_candidates == 500
    assert runtime.max_candidate_ranking_request_bytes == 8_388_608


def test_candidate_ranking_config_override() -> None:
    runtime = build_v2_runtime(
        environment=_runtime_environment(
            AI_CANDIDATE_RANKING_MAX_CANDIDATES="700",
            AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES="9000000",
        ),
        catalog_loader=lambda: main.v2_runtime.catalog,
    )

    assert runtime.max_candidate_ranking_candidates == 700
    assert runtime.max_candidate_ranking_request_bytes == 9_000_000


@pytest.mark.parametrize(
    "environment_key",
    [
        "AI_CANDIDATE_RANKING_MAX_CANDIDATES",
        "AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES",
    ],
)
@pytest.mark.parametrize("value", ["", "0", "-1", "+1", "1.5", "1e3", " 10", "10 ", "abc"])
def test_candidate_ranking_config_rejects_all_invalid_integer_forms(
    environment_key,
    value,
) -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.v2_runtime.catalog

    with pytest.raises(V2ConfigurationError, match="positive integer"):
        build_v2_runtime(
            environment=_runtime_environment(**{environment_key: value}),
            catalog_loader=catalog_loader,
        )

    assert catalog_loaded is False


def test_candidate_ranking_capacity_error_is_exactly_sanitized() -> None:
    response = error_response(candidate_ranking_capacity_exceeded_error())

    assert response.status_code == 413
    assert response.body == (
        b'{"errorCode":"CANDIDATE_RANKING_CAPACITY_EXCEEDED",'
        b'"message":"Candidate ranking request exceeds synchronous capacity."}'
    )


def test_candidate_ranking_text_preserves_valid_outer_whitespace() -> None:
    payload = valid_request()
    job_text = " \tTITLE:\nBackend Intern\r\n "
    candidate_text = "\n Persisted extracted CV text \t"
    payload["job"]["text"] = job_text
    payload["candidates"][0]["text"] = candidate_text

    request = CandidateRankingRequest.model_validate(payload)

    assert request.job.text == job_text
    assert request.candidates[0].text == candidate_text


@pytest.mark.parametrize("field_path", [("job", "text"), ("candidates", 0, "text")])
def test_candidate_ranking_text_rejects_whitespace_only(field_path) -> None:
    payload = valid_request()
    target = payload
    for key in field_path[:-1]:
        target = target[key]
    target[field_path[-1]] = " \t\r\n "

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("field_path", [("job", "text"), ("candidates", 0, "text")])
def test_candidate_ranking_text_rejects_raw_length_over_one_million(
    field_path,
) -> None:
    payload = valid_request()
    target = payload
    for key in field_path[:-1]:
        target = target[key]
    target[field_path[-1]] = "x" + (" " * 1_000_000)

    with pytest.raises(ValidationError):
        CandidateRankingRequest.model_validate(payload)


@pytest.mark.parametrize("field_path", [("job", "text"), ("candidates", 0, "text")])
def test_candidate_ranking_text_accepts_exactly_one_million_raw_characters(
    field_path,
) -> None:
    payload = valid_request()
    target = payload
    for key in field_path[:-1]:
        target = target[key]
    text = "x" + (" " * 999_999)
    target[field_path[-1]] = text

    request = CandidateRankingRequest.model_validate(payload)

    if field_path[0] == "job":
        assert request.job.text == text
    else:
        assert request.candidates[0].text == text
