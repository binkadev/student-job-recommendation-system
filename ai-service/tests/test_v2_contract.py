"""Contract and generated-schema tests for AI service V2."""

from copy import deepcopy
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

from v2.constants import ALGORITHM, ALGORITHM_VERSION, PROCESSING_VERSION
from v2.schemas import (
    ContractModel,
    CvInput,
    CvParseResponse,
    JobInput,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)


REQUEST_ID = "95b202eb-7f68-4b8f-b6fe-aeb496938259"


def valid_request() -> dict:
    return {
        "requestId": REQUEST_ID,
        "cv": {
            "id": 12,
            "text": "Java backend developer",
            "skills": ["java", "spring boot"],
        },
        "jobs": [
            {
                "id": 101,
                "text": "TITLE:\nBackend Developer",
                "skills": ["java", "postgresql"],
            }
        ],
        "threshold": 0.1,
        "limit": 20,
    }


def valid_result() -> dict:
    return {
        "jobId": 101,
        "score": 0.72,
        "textScore": 0.65,
        "skillScore": 0.85,
        "scoringStrategy": "SAME_LANGUAGE_HYBRID",
        "matchedSkills": ["java"],
        "missingSkills": ["postgresql"],
        "reason": "Matched 1 of 2 job skills: java.",
    }


def valid_response() -> dict:
    return {
        "requestId": REQUEST_ID,
        "algorithm": ALGORITHM,
        "algorithmVersion": ALGORITHM_VERSION,
        "results": [valid_result()],
    }


def valid_cv_parse_response() -> dict:
    return {
        "rawText": "Java developer",
        "processedText": "java developer",
        "skills": ["java"],
        "languageCode": "en",
        "languageConfidence": 0.98,
        "processingVersion": PROCESSING_VERSION,
        "warnings": [],
    }


def test_v2_constants_are_exact() -> None:
    assert ALGORITHM == "tfidf-cosine-hybrid"
    assert ALGORITHM_VERSION == "bilingual-recommendation-v2"
    assert PROCESSING_VERSION == "bilingual-nlp-v2-skills-v1"


def test_every_v2_model_forbids_extra_fields() -> None:
    models = [
        ContractModel,
        CvParseResponse,
        CvInput,
        JobInput,
        RecommendationRequest,
        RecommendationResult,
        RecommendationResponse,
    ]

    assert all(model.model_config.get("extra") == "forbid" for model in models)
    assert all(
        model.model_config.get("validate_default") is True
        for model in models
    )

    request_payload = valid_request()
    request_payload["unexpected"] = True
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(request_payload)

    response_payload = valid_response()
    response_payload["results"][0]["unexpected"] = True
    with pytest.raises(ValidationError):
        RecommendationResponse.model_validate(response_payload)


def test_generated_schemas_forbid_extra_fields_at_every_object_level() -> None:
    request_schema = RecommendationRequest.model_json_schema()
    response_schema = RecommendationResponse.model_json_schema()

    assert request_schema["additionalProperties"] is False
    assert request_schema["$defs"]["CvInput"]["additionalProperties"] is False
    assert request_schema["$defs"]["JobInput"]["additionalProperties"] is False
    assert response_schema["additionalProperties"] is False
    assert (
        response_schema["$defs"]["RecommendationResult"][
            "additionalProperties"
        ]
        is False
    )

    request_payload = valid_request()
    request_payload["cv"]["unexpected"] = True
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(request_payload)

    request_payload = valid_request()
    request_payload["jobs"][0]["unexpected"] = True
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(request_payload)


def test_request_id_must_be_a_uuid() -> None:
    request = RecommendationRequest.model_validate(valid_request())
    assert request.requestId == UUID(REQUEST_ID)

    payload = valid_request()
    payload["requestId"] = "legacy-request-id"
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize("model", [CvInput, JobInput])
@pytest.mark.parametrize("invalid_id", [True, False, 0, -1, "1", 1.0])
def test_ids_are_positive_strict_non_boolean_integers(model, invalid_id) -> None:
    with pytest.raises(ValidationError):
        model.model_validate(
            {
                "id": invalid_id,
                "text": "Java developer",
                "skills": ["java"],
            }
        )


@pytest.mark.parametrize("field_name", ["cv", "job"])
@pytest.mark.parametrize(
    "invalid_skill",
    [None, "", "   ", "x" * 151, 42, True],
)
def test_request_skill_items_are_strict_non_blank_and_bounded(
    field_name,
    invalid_skill,
) -> None:
    payload = valid_request()
    if field_name == "cv":
        payload["cv"]["skills"] = [invalid_skill]
    else:
        payload["jobs"][0]["skills"] = [invalid_skill]

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_request_skills_are_trimmed_without_truncating_input_lists() -> None:
    payload = valid_request()
    payload["cv"]["skills"] = [f" cv-skill-{index:03d} " for index in range(201)]
    payload["jobs"][0]["skills"] = [
        f" job-skill-{index:03d} " for index in range(250)
    ]

    request = RecommendationRequest.model_validate(payload)

    assert len(request.cv.skills) == 201
    assert len(request.jobs[0].skills) == 250
    assert request.cv.skills[0] == "cv-skill-000"
    assert request.jobs[0].skills[-1] == "job-skill-249"


@pytest.mark.parametrize(
    ("field_path", "replacement"),
    [
        (("cv", "skills"), ("java",)),
        (("jobs",), ()),
        (("jobs", 0, "skills"), ("java",)),
    ],
)
def test_request_collections_are_strict_lists(field_path, replacement) -> None:
    payload = valid_request()
    target = payload
    for key in field_path[:-1]:
        target = target[key]
    target[field_path[-1]] = replacement

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_request_skill_arrays_have_no_generated_max_items() -> None:
    schema = RecommendationRequest.model_json_schema()
    cv_skills = schema["$defs"]["CvInput"]["properties"]["skills"]
    job_skills = schema["$defs"]["JobInput"]["properties"]["skills"]

    assert "maxItems" not in cv_skills
    assert "maxItems" not in job_skills
    assert cv_skills["items"]["maxLength"] == 150
    assert job_skills["items"]["maxLength"] == 150


def test_threshold_is_decimal_and_bounded() -> None:
    request = RecommendationRequest.model_validate(valid_request())
    assert request.threshold == Decimal("0.1")
    assert isinstance(request.threshold, Decimal)

    for invalid_threshold in [
        True,
        False,
        "0.1",
        "-0.00000001",
        "1.00000001",
        "NaN",
        "Infinity",
    ]:
        payload = valid_request()
        payload["threshold"] = invalid_threshold
        with pytest.raises(ValidationError):
            RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize("missing_field", ["threshold", "limit"])
def test_threshold_and_limit_are_required(missing_field) -> None:
    payload = valid_request()
    del payload[missing_field]

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


@pytest.mark.parametrize("invalid_limit", [True, False, 0, 101, "20", 20.0])
def test_limit_is_a_strict_integer_from_one_to_one_hundred(
    invalid_limit,
) -> None:
    payload = valid_request()
    payload["limit"] = invalid_limit

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_duplicate_job_ids_are_rejected() -> None:
    payload = valid_request()
    duplicate = deepcopy(payload["jobs"][0])
    duplicate["text"] = "Another Job"
    payload["jobs"].append(duplicate)

    with pytest.raises(ValidationError, match="Job IDs must be unique"):
        RecommendationRequest.model_validate(payload)


def test_response_skill_arrays_accept_one_hundred_and_reject_one_hundred_one() -> None:
    payload = valid_response()
    payload["results"][0]["matchedSkills"] = [
        f"skill-{index:03d}" for index in range(100)
    ]
    payload["results"][0]["missingSkills"] = [
        f"missing-{index:03d}" for index in range(100)
    ]
    response = RecommendationResponse.model_validate(payload)
    assert len(response.results[0].matchedSkills) == 100
    assert len(response.results[0].missingSkills) == 100

    for field_name in ["matchedSkills", "missingSkills"]:
        oversized = valid_response()
        oversized["results"][0][field_name] = [
            f"skill-{index:03d}" for index in range(101)
        ]
        with pytest.raises(ValidationError):
            RecommendationResponse.model_validate(oversized)


def test_response_skill_arrays_generate_max_items_one_hundred() -> None:
    schema = RecommendationResponse.model_json_schema()
    result_properties = schema["$defs"]["RecommendationResult"]["properties"]

    assert result_properties["matchedSkills"]["maxItems"] == 100
    assert result_properties["missingSkills"]["maxItems"] == 100


@pytest.mark.parametrize("forbidden_field", ["rank", "rankPosition"])
def test_ai_response_schema_excludes_rank_fields(forbidden_field) -> None:
    schema = RecommendationResponse.model_json_schema()
    result_properties = schema["$defs"]["RecommendationResult"]["properties"]
    assert forbidden_field not in result_properties

    payload = valid_response()
    payload["results"][0][forbidden_field] = 1
    with pytest.raises(ValidationError):
        RecommendationResponse.model_validate(payload)


def test_response_requires_exact_algorithm_metadata() -> None:
    RecommendationResponse.model_validate(valid_response())

    for field_name in ["algorithm", "algorithmVersion"]:
        payload = valid_response()
        payload[field_name] = "wrong-version"
        with pytest.raises(ValidationError):
            RecommendationResponse.model_validate(payload)


def test_text_score_nullability_matches_scoring_strategy() -> None:
    same_language = valid_response()
    same_language["results"][0]["textScore"] = None
    with pytest.raises(ValidationError, match="requires textScore"):
        RecommendationResponse.model_validate(same_language)

    cross_language = valid_response()
    cross_language["results"][0]["scoringStrategy"] = (
        "CROSS_LANGUAGE_SKILL_BASED"
    )
    cross_language["results"][0]["textScore"] = None
    RecommendationResponse.model_validate(cross_language)

    cross_language["results"][0]["textScore"] = 0.5
    with pytest.raises(ValidationError, match="requires textScore=null"):
        RecommendationResponse.model_validate(cross_language)


def test_cv_parse_response_contract_is_strict_and_bounded() -> None:
    response = CvParseResponse.model_validate(valid_cv_parse_response())
    assert response.processingVersion == PROCESSING_VERSION

    payload = valid_cv_parse_response()
    payload["skills"] = [f"skill-{index:03d}" for index in range(201)]
    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)

    payload = valid_cv_parse_response()
    payload["warnings"] = [f"warning-{index:03d}" for index in range(101)]
    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)

    payload = valid_cv_parse_response()
    payload["unexpected"] = True
    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)


def test_cv_parse_raw_text_rejects_whitespace_only_content() -> None:
    payload = valid_cv_parse_response()
    payload["rawText"] = " \t\r\n "

    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)


def test_cv_parse_preserves_raw_text_and_trims_processed_text() -> None:
    payload = valid_cv_parse_response()
    raw_text = " \r\n  Original CV text \t\n "
    payload["rawText"] = raw_text
    payload["processedText"] = " \r\n processed CV text \t "

    response = CvParseResponse.model_validate(payload)

    assert response.rawText == raw_text
    assert response.model_dump()["rawText"] == raw_text
    assert response.processedText == "processed CV text"
