"""Stateless Job NLP snapshot preprocessing using the shared 3-stage spaCy pipeline."""

from __future__ import annotations

from typing import Protocol

from core.constants import LANGUAGE_CONFIDENCE_THRESHOLD, PROCESSING_VERSION
from nlp.english_pipeline import LoadedSpacyPipeline, preprocess_english_job, tokenize_english
from nlp.job_document import parse_job_document
from nlp.language_detector import detect_job_language, detect_language
from schemas.common import LanguageCode
from schemas.job_preprocessing import (
    JobPreprocessRequest,
    JobPreprocessResponse,
    JobPreprocessResult,
)


class JobLexicalInput(Protocol):
    """Structural contract shared by Recommendation JobInput & CandidateRankingJob."""

    text: str | None
    processedText: str | None
    languageCode: LanguageCode | None
    languageConfidence: float | None
    processingVersion: str | None


def resolve_job_lexical_snapshot(
    job: JobLexicalInput,
    *,
    spacy_pipeline: LoadedSpacyPipeline,
    tokenize_if_english: bool = True,
) -> tuple[bool, str]:
    """Return (job_is_confident_english, processed_text) skipping spaCy on valid snapshots."""

    if (
        job.processingVersion == PROCESSING_VERSION
        and job.languageCode is not None
        and job.languageConfidence is not None
    ):
        is_english = (
            job.languageCode is LanguageCode.ENGLISH
            and job.languageConfidence >= LANGUAGE_CONFIDENCE_THRESHOLD
        )
        if not is_english:
            return False, ""
        if job.processedText is not None and job.processedText.strip():
            return True, job.processedText
        if job.text is None:
            return False, ""

    if job.text is None:
        return False, ""

    detection = detect_job_language(job.text)
    if (
        detection.language_code is not LanguageCode.ENGLISH
        or detection.confidence < LANGUAGE_CONFIDENCE_THRESHOLD
    ):
        return False, ""

    if not tokenize_if_english:
        return True, ""

    return True, preprocess_english_job(
        job.text,
        nlp=spacy_pipeline.nlp,
        detection=detection,
    ).processed_text


def preprocess_jobs(
    request: JobPreprocessRequest,
    *,
    spacy_pipeline: LoadedSpacyPipeline,
) -> JobPreprocessResponse:
    """Detect language and tokenize each Job excluding any SKILLS section."""

    if not isinstance(request, JobPreprocessRequest):
        raise TypeError("request must be a JobPreprocessRequest")
    if not isinstance(spacy_pipeline, LoadedSpacyPipeline):
        raise TypeError("spacy_pipeline must be a LoadedSpacyPipeline")

    results: list[JobPreprocessResult] = []
    for item in request.jobs:
        parsed_job = parse_job_document(item.text)
        detection = detect_language(parsed_job.language_evidence_text)
        processed_text: str | None = None
        if (
            detection.language_code is LanguageCode.ENGLISH
            and detection.confidence >= LANGUAGE_CONFIDENCE_THRESHOLD
            and parsed_job.similarity_text
        ):
            tokens = tokenize_english(
                parsed_job.similarity_text,
                nlp=spacy_pipeline.nlp,
            )
            if tokens:
                processed_text = " ".join(tokens)

        results.append(
            JobPreprocessResult(
                id=item.id,
                processedText=processed_text,
                languageCode=detection.language_code,
                languageConfidence=detection.confidence,
                processingVersion=PROCESSING_VERSION,
            )
        )

    return JobPreprocessResponse(results=results)


__all__ = ["JobLexicalInput", "preprocess_jobs", "resolve_job_lexical_snapshot"]
