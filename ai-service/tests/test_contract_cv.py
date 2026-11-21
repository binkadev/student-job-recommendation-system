"""Contract and runtime configuration tests for CV parsing and capacity bounds."""

from __future__ import annotations

import os

from pydantic import ValidationError
import pytest

import main
from core.config import ConfigurationError
from core.constants import (
    ALGORITHM,
    CANDIDATE_RANKING_ALGORITHM_VERSION,
    PROCESSING_VERSION,
    RECOMMENDATION_ALGORITHM_VERSION,
)
from core.errors import (
    candidate_ranking_capacity_exceeded_error,
    error_response,
)
from schemas.cv import CvParseResponse
from services.runtime import build_runtime


TEST_INTERNAL_API_KEY = os.environ["AI_INTERNAL_API_KEY"]


def _valid_cv_parse_response() -> dict:
    return {
        "rawText": "Software Engineer with Java and Spring Boot experience.",
        "processedText": "software engineer java spring boot experience",
        "skills": ["java", "spring boot"],
        "languageCode": "en",
        "languageConfidence": 1.0,
        "processingVersion": PROCESSING_VERSION,
        "warnings": [],
    }


def _runtime_environment(**overrides: str) -> dict[str, str]:
    return {
        "AI_INTERNAL_API_KEY": TEST_INTERNAL_API_KEY,
        **overrides,
    }


def test_locked_contract_constants_are_exact() -> None:
    assert ALGORITHM == "tfidf-cosine-hybrid"
    assert RECOMMENDATION_ALGORITHM_VERSION == "english-global-idf-recommendation-v1"
    assert (
        CANDIDATE_RANKING_ALGORITHM_VERSION
        == "english-global-idf-candidate-ranking-v1"
    )
    assert PROCESSING_VERSION == "english-spacy-v1-skills-v1"


def test_cv_parse_response_contract_is_strict_and_bounded() -> None:
    response = CvParseResponse.model_validate(_valid_cv_parse_response())
    assert response.processingVersion == PROCESSING_VERSION

    payload = _valid_cv_parse_response()
    payload["skills"] = [f"skill-{index:03d}" for index in range(201)]
    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)

    payload = _valid_cv_parse_response()
    payload["warnings"] = [f"warning-{index:03d}" for index in range(101)]
    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)

    payload = _valid_cv_parse_response()
    payload["unexpected"] = True
    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)


def test_cv_parse_raw_text_rejects_whitespace_only_content() -> None:
    payload = _valid_cv_parse_response()
    payload["rawText"] = " \t\r\n "

    with pytest.raises(ValidationError):
        CvParseResponse.model_validate(payload)


def test_cv_parse_preserves_raw_text_and_trims_processed_text() -> None:
    payload = _valid_cv_parse_response()
    raw_text = " \r\n  Original CV text \t\n "
    payload["rawText"] = raw_text
    payload["processedText"] = " \r\n processed CV text \t "

    response = CvParseResponse.model_validate(payload)

    assert response.rawText == raw_text
    assert response.model_dump()["rawText"] == raw_text
    assert response.processedText == "processed CV text"


def test_runtime_config_defaults() -> None:
    runtime = build_runtime(
        environment=_runtime_environment(),
        catalog_loader=lambda: main.runtime.catalog,
    )

    assert runtime.max_file_size_bytes == 10_485_760
    assert runtime.cv_service.max_file_size_bytes == 10_485_760
    assert runtime.max_candidate_ranking_candidates == 500
    assert runtime.max_candidate_ranking_request_bytes == 8_388_608


def test_runtime_config_override() -> None:
    runtime = build_runtime(
        environment=_runtime_environment(
            AI_CV_MAX_FILE_SIZE_BYTES="5242880",
            AI_CANDIDATE_RANKING_MAX_CANDIDATES="700",
            AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES="9000000",
        ),
        catalog_loader=lambda: main.runtime.catalog,
    )

    assert runtime.max_file_size_bytes == 5_242_880
    assert runtime.max_candidate_ranking_candidates == 700
    assert runtime.max_candidate_ranking_request_bytes == 9_000_000


@pytest.mark.parametrize(
    "environment_key",
    [
        "AI_CV_MAX_FILE_SIZE_BYTES",
        "AI_CANDIDATE_RANKING_MAX_CANDIDATES",
        "AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES",
    ],
)
@pytest.mark.parametrize(
    "value",
    ["", "0", "-1", "+1", "1.5", "1e3", " 10", "10 ", "abc"],
)
def test_runtime_config_rejects_invalid_integer_forms(
    environment_key: str,
    value: str,
) -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.runtime.catalog

    with pytest.raises(ConfigurationError, match="positive integer"):
        build_runtime(
            environment=_runtime_environment(**{environment_key: value}),
            catalog_loader=catalog_loader,
        )

    assert catalog_loaded is False


def test_missing_internal_api_key_fails_before_catalog_load() -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.runtime.catalog

    with pytest.raises(ConfigurationError, match="must be configured"):
        build_runtime(environment={}, catalog_loader=catalog_loader)

    assert catalog_loaded is False


def test_short_internal_api_key_fails_before_catalog_load() -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.runtime.catalog

    with pytest.raises(ConfigurationError, match="at least 32 characters"):
        build_runtime(
            environment={"AI_INTERNAL_API_KEY": "too-short"},
            catalog_loader=catalog_loader,
        )

    assert catalog_loaded is False


@pytest.mark.parametrize(
    "value",
    [
        f" {TEST_INTERNAL_API_KEY}",
        f"{TEST_INTERNAL_API_KEY} ",
    ],
)
def test_internal_api_key_whitespace_fails_before_catalog_load(
    value: str,
) -> None:
    catalog_loaded = False

    def catalog_loader():
        nonlocal catalog_loaded
        catalog_loaded = True
        return main.runtime.catalog

    with pytest.raises(ConfigurationError, match="whitespace"):
        build_runtime(
            environment={"AI_INTERNAL_API_KEY": value},
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
