"""Fail-fast environment configuration validation for the AI Service."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
import os
from pathlib import Path
import re


_SERVICE_ROOT = Path(__file__).resolve().parents[1]
_MAX_FILE_SIZE_ENVIRONMENT_KEY = "AI_CV_MAX_FILE_SIZE_BYTES"
_CANDIDATE_RANKING_MAX_CANDIDATES_ENVIRONMENT_KEY = (
    "AI_CANDIDATE_RANKING_MAX_CANDIDATES"
)
_CANDIDATE_RANKING_MAX_REQUEST_BYTES_ENVIRONMENT_KEY = (
    "AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES"
)
_INTERNAL_API_KEY_ENVIRONMENT_KEY = "AI_INTERNAL_API_KEY"
_SPACY_MODEL_DIR_ENVIRONMENT_KEY = "AI_SPACY_MODEL_DIR"
_TFIDF_MODEL_PATH_ENVIRONMENT_KEY = "AI_TFIDF_MODEL_PATH"
_TFIDF_BOOTSTRAP_MODEL_PATH_ENVIRONMENT_KEY = "AI_TFIDF_BOOTSTRAP_MODEL_PATH"

_MINIMUM_INTERNAL_API_KEY_LENGTH = 32
_DEFAULT_MAX_FILE_SIZE_BYTES = 10_485_760
_DEFAULT_CANDIDATE_RANKING_MAX_CANDIDATES = 500
_DEFAULT_CANDIDATE_RANKING_MAX_REQUEST_BYTES = 8_388_608
_DEFAULT_SPACY_MODEL_DIR = _SERVICE_ROOT / "built_models" / "spacy_custom_model"
_DEFAULT_TFIDF_MODEL_PATH = (
    _SERVICE_ROOT / "models" / "tfidf" / "tfidf_model.pkl"
)
_DEFAULT_TFIDF_BOOTSTRAP_MODEL_PATH = (
    _SERVICE_ROOT / "built_models" / "tfidf" / "tfidf_model.pkl"
)
_POSITIVE_INTEGER_PATTERN = re.compile(r"[1-9][0-9]*")


class ConfigurationError(ValueError):
    """Raised before readiness when startup configuration is invalid."""


@dataclass(frozen=True, slots=True)
class AppSettings:
    """Validated immutable environment settings."""

    internal_api_key: str
    max_file_size_bytes: int = _DEFAULT_MAX_FILE_SIZE_BYTES
    max_candidate_ranking_candidates: int = (
        _DEFAULT_CANDIDATE_RANKING_MAX_CANDIDATES
    )
    max_candidate_ranking_request_bytes: int = (
        _DEFAULT_CANDIDATE_RANKING_MAX_REQUEST_BYTES
    )
    spacy_model_dir: Path = _DEFAULT_SPACY_MODEL_DIR
    tfidf_model_path: Path = _DEFAULT_TFIDF_MODEL_PATH
    tfidf_bootstrap_model_path: Path | None = _DEFAULT_TFIDF_BOOTSTRAP_MODEL_PATH


def _parse_positive_integer(
    environment: Mapping[str, str],
    environment_key: str,
    default: int,
) -> int:
    value = environment.get(environment_key)
    if value is None:
        return default
    if not _POSITIVE_INTEGER_PATTERN.fullmatch(value):
        raise ConfigurationError(
            f"{environment_key} must be a positive integer"
        )
    return int(value)


def _parse_path(
    environment: Mapping[str, str],
    environment_key: str,
    default: Path,
) -> Path:
    value = environment.get(environment_key)
    if value is None:
        return default
    if not value.strip() or value != value.strip():
        raise ConfigurationError(
            f"{environment_key} must be a non-blank path without edge whitespace"
        )
    return Path(value)


def _parse_optional_path(
    environment: Mapping[str, str],
    environment_key: str,
    default: Path | None,
) -> Path | None:
    value = environment.get(environment_key)
    if value is None:
        return default
    if not value:
        return None
    if not value.strip() or value != value.strip():
        raise ConfigurationError(
            f"{environment_key} must be a non-blank path without edge whitespace"
        )
    return Path(value)


def parse_max_file_size_bytes(environment: Mapping[str, str]) -> int:
    """Resolve the upload limit once using strict positive decimal syntax."""

    return _parse_positive_integer(
        environment,
        _MAX_FILE_SIZE_ENVIRONMENT_KEY,
        _DEFAULT_MAX_FILE_SIZE_BYTES,
    )


def parse_candidate_ranking_max_candidates(
    environment: Mapping[str, str],
) -> int:
    """Resolve the synchronous candidate-count safeguard."""

    return _parse_positive_integer(
        environment,
        _CANDIDATE_RANKING_MAX_CANDIDATES_ENVIRONMENT_KEY,
        _DEFAULT_CANDIDATE_RANKING_MAX_CANDIDATES,
    )


def parse_candidate_ranking_max_request_bytes(
    environment: Mapping[str, str],
) -> int:
    """Resolve the synchronous serialized-request safeguard."""

    return _parse_positive_integer(
        environment,
        _CANDIDATE_RANKING_MAX_REQUEST_BYTES_ENVIRONMENT_KEY,
        _DEFAULT_CANDIDATE_RANKING_MAX_REQUEST_BYTES,
    )


def parse_internal_api_key(environment: Mapping[str, str]) -> str:
    """Resolve the required shared key without normalizing its value."""

    value = environment.get(_INTERNAL_API_KEY_ENVIRONMENT_KEY)
    if value is None:
        raise ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must be configured"
        )
    if not value:
        raise ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must not be blank"
        )
    if value != value.strip():
        raise ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must not have "
            "leading or trailing whitespace"
        )
    if len(value) < _MINIMUM_INTERNAL_API_KEY_LENGTH:
        raise ConfigurationError(
            f"{_INTERNAL_API_KEY_ENVIRONMENT_KEY} must be at least "
            f"{_MINIMUM_INTERNAL_API_KEY_LENGTH} characters"
        )
    return value


def load_settings(
    environment: Mapping[str, str] | None = None,
) -> AppSettings:
    """Validate and construct immutable runtime settings."""

    configured_environment = os.environ if environment is None else environment
    return AppSettings(
        internal_api_key=parse_internal_api_key(configured_environment),
        max_file_size_bytes=parse_max_file_size_bytes(configured_environment),
        max_candidate_ranking_candidates=parse_candidate_ranking_max_candidates(
            configured_environment
        ),
        max_candidate_ranking_request_bytes=(
            parse_candidate_ranking_max_request_bytes(configured_environment)
        ),
        spacy_model_dir=_parse_path(
            configured_environment,
            _SPACY_MODEL_DIR_ENVIRONMENT_KEY,
            _DEFAULT_SPACY_MODEL_DIR,
        ),
        tfidf_model_path=_parse_path(
            configured_environment,
            _TFIDF_MODEL_PATH_ENVIRONMENT_KEY,
            _DEFAULT_TFIDF_MODEL_PATH,
        ),
        tfidf_bootstrap_model_path=_parse_optional_path(
            configured_environment,
            _TFIDF_BOOTSTRAP_MODEL_PATH_ENVIRONMENT_KEY,
            _DEFAULT_TFIDF_BOOTSTRAP_MODEL_PATH,
        ),
    )


__all__ = [
    "AppSettings",
    "ConfigurationError",
    "load_settings",
    "parse_candidate_ranking_max_candidates",
    "parse_candidate_ranking_max_request_bytes",
    "parse_internal_api_key",
    "parse_max_file_size_bytes",
]
