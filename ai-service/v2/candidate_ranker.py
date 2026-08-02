"""Pure deterministic scoring for recruiter-side candidate ranking."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, localcontext
import math

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .candidate_ranking_schemas import (
    CandidateRankingCandidate,
    CandidateRankingJob,
)
from .constants import ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD
from .language_detector import LanguageDetection
from .preprocessor import (
    preprocess_english,
    preprocess_english_job,
    preprocess_vietnamese,
    preprocess_vietnamese_job,
)
from .recommender import (
    _SCORING_DECIMAL_CONTEXT,
    project_public_score,
)
from .schemas import LanguageCode, ScoringStrategy
from .skill_canonicalizer import SkillCatalog


_TEXT_WEIGHT = Decimal("0.65")
_SKILL_WEIGHT = Decimal("0.35")
_ZERO = Decimal("0")
_ONE = Decimal("1")


@dataclass(frozen=True, slots=True)
class ScoredCandidate:
    """A score result before response-model serialization."""

    application_id: int
    cv_id: int
    score: Decimal
    text_score: Decimal | None
    skill_score: Decimal
    scoring_strategy: ScoringStrategy
    matched_skills: tuple[str, ...]
    missing_skills: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class _PreparedCandidate:
    candidate: CandidateRankingCandidate
    canonical_skills: frozenset[str]
    processed_text: str | None


def _is_empty_vocabulary_error(error: ValueError) -> bool:
    return "empty vocabulary" in str(error).casefold()


def _build_vectorizer() -> TfidfVectorizer:
    """Build the exact V2 vectorizer used by Student-to-Job scoring."""

    return TfidfVectorizer(
        analyzer="word",
        tokenizer=str.split,
        token_pattern=None,
        lowercase=False,
        ngram_range=(1, 2),
        sublinear_tf=True,
        stop_words=None,
    )


def _reverse_text_scores(
    *,
    job_processed_text: str,
    candidates: tuple[_PreparedCandidate, ...],
) -> tuple[float, ...]:
    """Fit once on Candidates, then transform the selected Job once."""

    vectorizer = _build_vectorizer()
    candidate_documents = [
        candidate.processed_text or "" for candidate in candidates
    ]
    try:
        candidate_vectors = vectorizer.fit_transform(candidate_documents)
    except ValueError as error:
        if not _is_empty_vocabulary_error(error):
            raise
        return tuple(0.0 for _candidate in candidates)

    job_vector = vectorizer.transform([job_processed_text])
    similarities = cosine_similarity(job_vector, candidate_vectors).ravel()
    scores = tuple(float(similarity) for similarity in similarities)
    if len(scores) != len(candidates):
        raise ValueError("TF-IDF returned an unexpected Candidate score count")
    return scores


def _preprocess_candidate(
    candidate: CandidateRankingCandidate,
    detection: LanguageDetection,
    language: LanguageCode,
) -> str:
    if language is LanguageCode.ENGLISH:
        return preprocess_english(
            candidate.text,
            detection=detection,
        ).processed_text
    if language is LanguageCode.VIETNAMESE:
        return preprocess_vietnamese(
            candidate.text,
            detection=detection,
        ).processed_text
    raise ValueError("same-language Candidate must have a supported language")


def _preprocess_job(
    job: CandidateRankingJob,
    detection: LanguageDetection,
    language: LanguageCode,
) -> str:
    if language is LanguageCode.ENGLISH:
        return preprocess_english_job(
            job.text,
            detection=detection,
        ).processed_text
    if language is LanguageCode.VIETNAMESE:
        return preprocess_vietnamese_job(
            job.text,
            detection=detection,
        ).processed_text
    raise ValueError("same-language Job must have a supported language")


def _skill_overlap(
    candidate_skills: frozenset[str],
    job_skills: frozenset[str],
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    return (
        tuple(sorted(candidate_skills & job_skills)),
        tuple(sorted(job_skills - candidate_skills)),
    )


def _raw_skill_score(
    matched_count: int,
    job_skill_count: int,
) -> Decimal:
    if job_skill_count == 0:
        return _ZERO
    with localcontext(_SCORING_DECIMAL_CONTEXT):
        return Decimal(matched_count) / Decimal(job_skill_count)


def _score_same_language(
    *,
    job_skills: frozenset[str],
    candidates: tuple[_PreparedCandidate, ...],
    raw_text_scores: tuple[float, ...],
    threshold: Decimal,
) -> list[ScoredCandidate]:
    scored: list[ScoredCandidate] = []
    for candidate, raw_text_score_float in zip(
        candidates,
        raw_text_scores,
        strict=True,
    ):
        if not math.isfinite(raw_text_score_float):
            raise ValueError("TF-IDF cosine similarity must be finite")

        matched_skills, missing_skills = _skill_overlap(
            candidate.canonical_skills,
            job_skills,
        )
        raw_text_score = Decimal(str(raw_text_score_float))
        raw_skill_score = _raw_skill_score(
            len(matched_skills),
            len(job_skills),
        )
        with localcontext(_SCORING_DECIMAL_CONTEXT):
            if job_skills:
                raw_score = (
                    _TEXT_WEIGHT * raw_text_score
                    + _SKILL_WEIGHT * raw_skill_score
                )
            else:
                raw_score = raw_text_score

        text_score = project_public_score(raw_text_score)
        skill_score = project_public_score(raw_skill_score)
        score = project_public_score(raw_score)
        if score < threshold:
            continue
        scored.append(
            ScoredCandidate(
                application_id=candidate.candidate.applicationId,
                cv_id=candidate.candidate.cvId,
                score=score,
                text_score=text_score,
                skill_score=skill_score,
                scoring_strategy=ScoringStrategy.SAME_LANGUAGE_HYBRID,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
            )
        )
    return scored


def _score_cross_language(
    *,
    job_skills: frozenset[str],
    candidates: tuple[_PreparedCandidate, ...],
    threshold: Decimal,
) -> list[ScoredCandidate]:
    scored: list[ScoredCandidate] = []
    for candidate in candidates:
        matched_skills, missing_skills = _skill_overlap(
            candidate.canonical_skills,
            job_skills,
        )
        raw_skill_score = _raw_skill_score(
            len(matched_skills),
            len(job_skills),
        )
        skill_score = project_public_score(raw_skill_score)
        score = skill_score
        if score < threshold:
            continue
        scored.append(
            ScoredCandidate(
                application_id=candidate.candidate.applicationId,
                cv_id=candidate.candidate.cvId,
                score=score,
                text_score=None,
                skill_score=skill_score,
                scoring_strategy=ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                matched_skills=matched_skills,
                missing_skills=missing_skills,
            )
        )
    return scored


def rank_candidates(
    *,
    job: CandidateRankingJob,
    job_detection: LanguageDetection,
    same_language_candidates: tuple[
        tuple[CandidateRankingCandidate, LanguageDetection], ...
    ],
    cross_language_candidates: tuple[
        tuple[CandidateRankingCandidate, LanguageDetection], ...
    ],
    threshold: Decimal,
    limit: int,
    catalog: SkillCatalog,
) -> tuple[ScoredCandidate, ...]:
    """Score the complete Candidate corpus and return deterministic Top K."""

    if not isinstance(job, CandidateRankingJob):
        raise TypeError("job must be a CandidateRankingJob")
    if not isinstance(job_detection, LanguageDetection):
        raise TypeError("job_detection must be a LanguageDetection")
    if not isinstance(catalog, SkillCatalog):
        raise TypeError("catalog must be a SkillCatalog")
    if not isinstance(threshold, Decimal):
        raise TypeError("threshold must be a Decimal")
    if not threshold.is_finite() or threshold < _ZERO or threshold > _ONE:
        raise ValueError("threshold must be finite and between 0 and 1")
    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("limit must be an integer")
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100")

    confident_language = job_detection.language_code
    if confident_language not in {
        LanguageCode.ENGLISH,
        LanguageCode.VIETNAMESE,
    }:
        if same_language_candidates:
            raise ValueError("unsupported Job language for same-language Candidates")
    elif job_detection.confidence < ENGLISH_LANGUAGE_CONFIDENCE_THRESHOLD:
        if same_language_candidates:
            raise ValueError("low-confidence Job language for same-language Candidates")

    job_skills = catalog.canonicalize_many(job.skills)
    same_entries = tuple(
        sorted(
            same_language_candidates,
            key=lambda item: item[0].applicationId,
        )
    )
    cross_entries = tuple(
        sorted(
            cross_language_candidates,
            key=lambda item: item[0].applicationId,
        )
    )

    same_candidates: list[_PreparedCandidate] = []
    for candidate, detection in same_entries:
        if not isinstance(candidate, CandidateRankingCandidate):
            raise TypeError("same-language entries must contain Candidates")
        if not isinstance(detection, LanguageDetection):
            raise TypeError("Candidate detection must be a LanguageDetection")
        same_candidates.append(
            _PreparedCandidate(
                candidate=candidate,
                canonical_skills=catalog.canonicalize_many(candidate.skills),
                processed_text=_preprocess_candidate(
                    candidate,
                    detection,
                    confident_language,
                ),
            )
        )

    cross_candidates: list[_PreparedCandidate] = []
    for candidate, _detection in cross_entries:
        if not isinstance(candidate, CandidateRankingCandidate):
            raise TypeError("cross-language entries must contain Candidates")
        cross_candidates.append(
            _PreparedCandidate(
                candidate=candidate,
                canonical_skills=catalog.canonicalize_many(candidate.skills),
                processed_text=None,
            )
        )

    scored: list[ScoredCandidate] = []
    if same_candidates:
        prepared_same = tuple(same_candidates)
        job_processed_text = _preprocess_job(
            job,
            job_detection,
            confident_language,
        )
        raw_text_scores = _reverse_text_scores(
            job_processed_text=job_processed_text,
            candidates=prepared_same,
        )
        scored.extend(
            _score_same_language(
                job_skills=job_skills,
                candidates=prepared_same,
                raw_text_scores=raw_text_scores,
                threshold=threshold,
            )
        )

    if cross_candidates:
        scored.extend(
            _score_cross_language(
                job_skills=job_skills,
                candidates=tuple(cross_candidates),
                threshold=threshold,
            )
        )

    scored.sort(key=lambda result: result.application_id)
    scored.sort(key=lambda result: result.score, reverse=True)
    return tuple(scored[:limit])
