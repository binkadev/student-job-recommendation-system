"""Strict Pydantic response schema for CV parsing."""

from typing import Literal

from core.constants import PROCESSING_VERSION

from .common import (
    ContractModel,
    LanguageCode,
    ParsedSkills,
    RawText,
    StrictUnitFloat,
    StrippedProcessedText,
    Warnings,
)


class CvParseResponse(ContractModel):
    rawText: RawText
    processedText: StrippedProcessedText
    skills: ParsedSkills
    languageCode: LanguageCode
    languageConfidence: StrictUnitFloat
    processingVersion: Literal[PROCESSING_VERSION]
    warnings: Warnings
