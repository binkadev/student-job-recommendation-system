"""Shared strict Pydantic base models, enums, and constrained wire types."""

from decimal import Decimal
from enum import StrEnum
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)


PositiveId = Annotated[int, Field(strict=True, gt=0)]
Limit = Annotated[int, Field(strict=True, ge=1, le=100)]
TierLimit = Annotated[int, Field(strict=True, ge=0, le=100)]


def _require_numeric(value: object, *, field_name: str) -> object:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError(f"{field_name} must be a numeric value")
    return value


def _require_numeric_threshold(value: object) -> object:
    return _require_numeric(value, field_name="Threshold")


def _require_numeric_confidence(value: object) -> object:
    return _require_numeric(value, field_name="Language confidence")


def _require_non_blank_text(value: str, *, label: str) -> str:
    if not any(not character.isspace() for character in value):
        raise ValueError(f"{label} must contain a non-whitespace character")
    return value


def _require_non_blank_raw_text(value: str) -> str:
    return _require_non_blank_text(value, label="Raw text")


def _require_non_blank_processed_text(value: str) -> str:
    return _require_non_blank_text(value, label="Processed text")


def _require_public_score_scale(value: float) -> float:
    if Decimal(str(value)).as_tuple().exponent < -8:
        raise ValueError("Scores must have at most 8 decimal places")
    return value


Threshold = Annotated[
    Decimal,
    Field(ge=Decimal("0"), le=Decimal("1"), allow_inf_nan=False),
    BeforeValidator(_require_numeric_threshold),
]
LanguageConfidence = Annotated[
    float,
    Field(ge=0.0, le=1.0, allow_inf_nan=False),
    BeforeValidator(_require_numeric_confidence),
]
StrictUnitFloat = Annotated[
    float,
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
]
Score = Annotated[
    float,
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
    AfterValidator(_require_public_score_scale),
]
Skill = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=150,
    ),
]
JobText = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
    ),
]
RawText = Annotated[
    str,
    StringConstraints(
        strict=True,
        min_length=1,
        max_length=1_000_000,
    ),
    AfterValidator(_require_non_blank_raw_text),
]
ProcessedText = Annotated[
    str,
    StringConstraints(strict=True, min_length=1, max_length=1_000_000),
    AfterValidator(_require_non_blank_processed_text),
]
StrippedProcessedText = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=1_000_000,
    ),
]
Reason = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=2_000,
    ),
]
WarningCode = Annotated[
    str,
    StringConstraints(
        strict=True,
        strip_whitespace=True,
        min_length=1,
        max_length=2_000,
    ),
]

InputSkills = Annotated[list[Skill], Field(strict=True)]
ParsedSkills = Annotated[list[Skill], Field(strict=True, max_length=200)]
JobSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]
ResultSkills = Annotated[list[Skill], Field(strict=True, max_length=100)]
Warnings = Annotated[list[WarningCode], Field(strict=True, max_length=100)]


class ContractModel(BaseModel):
    """Base model that rejects unknown fields at every wire boundary."""

    model_config = ConfigDict(extra="forbid", validate_default=True)


class LanguageCode(StrEnum):
    ENGLISH = "en"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class ScoringStrategy(StrEnum):
    SAME_LANGUAGE_HYBRID = "SAME_LANGUAGE_HYBRID"
    CROSS_LANGUAGE_SKILL_BASED = "CROSS_LANGUAGE_SKILL_BASED"


class RankingTier(StrEnum):
    PRIMARY = "PRIMARY"
    FALLBACK = "FALLBACK"
