"""Focused routing, scoring, ordering, and safety tests for Company V3."""

from types import SimpleNamespace

import numpy as np
import pytest

import v2.language_detector as language_detector_module
import v2.preprocessor as preprocessor_module
import v3.candidate_ranker as ranker_module
import v3.candidate_ranking_service as service_module
from v2.language_detector import LanguageDetection, detect_job_language
from v2.schemas import LanguageCode, ScoringStrategy
from v3.candidate_ranking_schemas import CandidateRankingRequest
from v3.candidate_ranking_service import rank_candidate_request
from v3.constants import PROCESSING_VERSION
from v3.schemas import RankingTier


REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"
ENGLISH_JOB = (
    "TITLE:\nBackend Developer\n"
    "DESCRIPTION:\nBuild and maintain reliable software services for users.\n"
    "REQUIREMENTS:\nCandidates have software development experience and "
    "project knowledge.\n"
    "SKILLS:\nJava Spring Boot PostgreSQL Docker"
)
VIETNAMESE_JOB = (
    "TITLE:\nLập trình viên Backend\n"
    "DESCRIPTION:\nPhát triển phần mềm và REST API cho người dùng.\n"
    "REQUIREMENTS:\nCó kinh nghiệm làm việc với kiến trúc vi dịch vụ và "
    "cơ sở dữ liệu.\n"
    "SKILLS:\nJava Spring Boot PostgreSQL Docker"
)
LOW_CONFIDENCE_ENGLISH_JOB = "TITLE:\nWe develop"
ENGLISH_PROCESSED = "software engineer developed service java spring_boot"
VIETNAMESE_PROCESSED = "kỹ_sư_phần_mềm kinh_nghiệm phát_triển java spring_boot"


def _request(
    *,
    job_text: str = ENGLISH_JOB,
    job_skills: list[str] | None = None,
    candidates: list[tuple[int, int, str, list[str], str, float]] | None = None,
    threshold: float = 0,
    primary_limit: int = 100,
    fallback_limit: int = 0,
) -> CandidateRankingRequest:
    if job_skills is None:
        job_skills = ["java", "spring boot"]
    if candidates is None:
        candidates = [(300, 55, ENGLISH_PROCESSED, ["java"], "en", 1.0)]
    return CandidateRankingRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "job": {"id": 10, "text": job_text, "skills": job_skills},
            "candidates": [
                {
                    "applicationId": application_id,
                    "cvId": cv_id,
                    "processedText": processed_text,
                    "skills": skills,
                    "languageCode": language_code,
                    "languageConfidence": confidence,
                    "processingVersion": PROCESSING_VERSION,
                }
                for (
                    application_id,
                    cv_id,
                    processed_text,
                    skills,
                    language_code,
                    confidence,
                ) in candidates
            ],
            "threshold": threshold,
            "primaryLimit": primary_limit,
            "fallbackLimit": fallback_limit,
        }
    )


@pytest.mark.parametrize(
    ("job_text", "candidate_text", "language"),
    [
        (ENGLISH_JOB, ENGLISH_PROCESSED, "en"),
        (VIETNAMESE_JOB, VIETNAMESE_PROCESSED, "vi"),
    ],
)
def test_confident_same_language_candidate_is_primary(
    job_text: str,
    candidate_text: str,
    language: str,
) -> None:
    result = rank_candidate_request(
        _request(
            job_text=job_text,
            candidates=[(300, 55, candidate_text, ["java"], language, 1.0)],
        )
    ).results[0]

    assert result.rankingTier is RankingTier.PRIMARY
    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.textScore is not None
    assert result.overallScore == result.rankingScore


@pytest.mark.parametrize(
    ("job_text", "candidate_text", "language"),
    [
        (ENGLISH_JOB, VIETNAMESE_PROCESSED, "vi"),
        (VIETNAMESE_JOB, ENGLISH_PROCESSED, "en"),
    ],
)
def test_cross_language_candidate_is_fallback(
    job_text: str,
    candidate_text: str,
    language: str,
) -> None:
    result = rank_candidate_request(
        _request(
            job_text=job_text,
            candidates=[(300, 55, candidate_text, ["java"], language, 1.0)],
            primary_limit=0,
            fallback_limit=100,
        )
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK
    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.overallScore is None


def test_low_confidence_candidate_is_fallback() -> None:
    result = rank_candidate_request(
        _request(
            candidates=[(300, 55, ENGLISH_PROCESSED, ["java"], "en", 0.64999999)],
            primary_limit=0,
            fallback_limit=100,
        )
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK


@pytest.mark.parametrize("language", ["mixed", "unknown"])
def test_mixed_or_unknown_candidate_metadata_is_fallback(language: str) -> None:
    result = rank_candidate_request(
        _request(
            candidates=[(300, 55, ENGLISH_PROCESSED, ["java"], language, 1.0)],
            primary_limit=0,
            fallback_limit=100,
        )
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK


def test_low_confidence_job_makes_every_candidate_fallback() -> None:
    detection = detect_job_language(LOW_CONFIDENCE_ENGLISH_JOB)
    assert detection.confidence < 0.65
    response = rank_candidate_request(
        _request(
            job_text=LOW_CONFIDENCE_ENGLISH_JOB,
            candidates=[
                (300, 55, ENGLISH_PROCESSED, ["java"], "en", 1.0),
                (301, 56, VIETNAMESE_PROCESSED, ["java"], "vi", 1.0),
            ],
            primary_limit=0,
            fallback_limit=100,
        )
    )

    assert all(result.rankingTier is RankingTier.FALLBACK for result in response.results)


def test_primary_formula_uses_raw_unrounded_components(monkeypatch) -> None:
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda **_kwargs: (0.123456785,),
    )
    result = rank_candidate_request(
        _request(
            job_skills=["java", "docker", "postgresql"],
            candidates=[
                (300, 55, ENGLISH_PROCESSED, ["java", "docker"], "en", 1.0)
            ],
        )
    ).results[0]

    assert result.textScore == 0.12345679
    assert result.skillScore == 0.66666667
    assert result.overallScore == result.rankingScore == 0.31358024


def test_primary_job_without_skills_is_text_only(monkeypatch) -> None:
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda **_kwargs: (0.4,),
    )
    result = rank_candidate_request(_request(job_skills=[])).results[0]

    assert result.skillScore == 0.0
    assert result.textScore == 0.4
    assert result.overallScore == result.rankingScore == result.textScore


def test_fallback_full_skills_has_no_text_or_overall_score() -> None:
    skills = ["java", "spring boot", "postgresql", "docker"]
    result = rank_candidate_request(
        _request(
            job_skills=skills,
            candidates=[(300, 55, VIETNAMESE_PROCESSED, skills, "vi", 1.0)],
            primary_limit=0,
            fallback_limit=100,
        )
    ).results[0]

    assert result.rankingScore == result.skillScore == 1.0
    assert result.textScore is None
    assert result.overallScore is None


def test_threshold_zero_retains_skillless_zero_score_fallback() -> None:
    result = rank_candidate_request(
        _request(
            job_skills=[],
            candidates=[(300, 55, VIETNAMESE_PROCESSED, [], "vi", 1.0)],
            threshold=0,
            primary_limit=0,
            fallback_limit=100,
        )
    ).results[0]

    assert result.rankingScore == result.skillScore == 0.0


def test_fallback_threshold_is_inclusive_on_projected_score() -> None:
    arguments = {
        "job_skills": ["java", "docker", "postgresql"],
        "candidates": [
            (300, 55, VIETNAMESE_PROCESSED, ["java"], "vi", 1.0)
        ],
        "primary_limit": 0,
        "fallback_limit": 100,
    }

    equal = rank_candidate_request(_request(**arguments, threshold=0.33333333))
    higher = rank_candidate_request(_request(**arguments, threshold=0.33333334))

    assert equal.results[0].rankingScore == 0.33333333
    assert higher.results == []


def test_complete_skill_sets_drive_score_before_evidence_serialization() -> None:
    job_skills = [f"skill-{index:03d}" for index in range(100)]
    matched = job_skills[:60]
    result = rank_candidate_request(
        _request(
            job_skills=job_skills,
            candidates=[(300, 55, VIETNAMESE_PROCESSED, matched, "vi", 1.0)],
            primary_limit=0,
            fallback_limit=100,
        )
    ).results[0]

    assert result.skillScore == result.rankingScore == 0.6
    assert result.matchedSkills == sorted(matched)
    assert result.missingSkills == sorted(job_skills[60:])


def test_independent_top_k_ties_and_primary_precedence(monkeypatch) -> None:
    primary_scores = {303: 0.4, 301: 0.8, 302: 0.8}
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda *, job_processed_text, candidates: tuple(
            primary_scores[candidate.application_id] for candidate in candidates
        ),
    )
    request = _request(
        job_skills=["java"],
        candidates=[
            (303, 63, ENGLISH_PROCESSED, [], "en", 1.0),
            (400, 70, VIETNAMESE_PROCESSED, ["java"], "vi", 1.0),
            (301, 61, ENGLISH_PROCESSED, [], "en", 1.0),
            (401, 71, VIETNAMESE_PROCESSED, ["java"], "vi", 1.0),
            (302, 62, ENGLISH_PROCESSED, [], "en", 1.0),
            (402, 72, VIETNAMESE_PROCESSED, [], "vi", 1.0),
        ],
        primary_limit=2,
        fallback_limit=2,
    )
    results = rank_candidate_request(request).results

    assert [result.applicationId for result in results] == [301, 302, 400, 401]
    assert [result.rankingTier for result in results] == [
        RankingTier.PRIMARY,
        RankingTier.PRIMARY,
        RankingTier.FALLBACK,
        RankingTier.FALLBACK,
    ]
    assert results[1].rankingScore < results[2].rankingScore


def test_input_order_does_not_change_output() -> None:
    candidates = [
        (303, 63, ENGLISH_PROCESSED + " alpha", ["java"], "en", 1.0),
        (301, 61, ENGLISH_PROCESSED + " beta", ["java"], "en", 1.0),
        (400, 70, VIETNAMESE_PROCESSED, ["java"], "vi", 1.0),
    ]
    first = rank_candidate_request(
        _request(candidates=candidates, primary_limit=50, fallback_limit=50)
    ).model_dump(mode="json")
    second = rank_candidate_request(
        _request(
            candidates=list(reversed(candidates)),
            primary_limit=50,
            fallback_limit=50,
        )
    ).model_dump(mode="json")

    assert first == second


class _SpyVectorizer:
    instances: list["_SpyVectorizer"] = []

    def __init__(self, **configuration) -> None:
        self.configuration = configuration
        self.fit_documents: list[str] = []
        self.transform_documents: list[str] = []
        self.fit_transform_calls = 0
        self.transform_calls = 0
        self.__class__.instances.append(self)

    def fit_transform(self, documents):
        self.fit_transform_calls += 1
        self.fit_documents = list(documents)
        return np.eye(len(self.fit_documents))

    def transform(self, documents):
        self.transform_calls += 1
        self.transform_documents = list(documents)
        return np.ones((1, len(self.fit_documents)))


def test_complete_primary_corpus_fits_once_and_job_transforms_once(monkeypatch) -> None:
    _SpyVectorizer.instances.clear()
    monkeypatch.setattr(ranker_module, "TfidfVectorizer", _SpyVectorizer)
    persisted = {
        303: "  persisted candidate three  \n",
        301: "persisted candidate one",
        302: "persisted candidate two",
    }
    rank_candidate_request(
        _request(
            candidates=[
                (application_id, application_id, text, [], "en", 1.0)
                for application_id, text in persisted.items()
            ],
            threshold=1,
            primary_limit=1,
            fallback_limit=0,
        )
    )
    vectorizer = _SpyVectorizer.instances[0]

    assert vectorizer.configuration == {
        "analyzer": "word",
        "tokenizer": str.split,
        "token_pattern": None,
        "lowercase": False,
        "ngram_range": (1, 2),
        "sublinear_tf": True,
        "stop_words": None,
    }
    assert vectorizer.fit_transform_calls == 1
    assert vectorizer.fit_documents == [persisted[301], persisted[302], persisted[303]]
    assert vectorizer.transform_calls == 1
    assert len(vectorizer.transform_documents) == 1


def test_candidate_detection_and_preprocessing_never_run_and_job_runs_once(
    monkeypatch,
) -> None:
    calls = {"job_detection": 0, "job_preprocessing": 0}
    detection = LanguageDetection(LanguageCode.ENGLISH, 1.0, 6, 0)

    def detect_job(text: str) -> LanguageDetection:
        assert text == ENGLISH_JOB
        calls["job_detection"] += 1
        return detection

    def preprocess_job(text: str, *, detection: LanguageDetection):
        assert text == ENGLISH_JOB
        calls["job_preprocessing"] += 1
        return SimpleNamespace(processed_text="processed job")

    def forbidden(*_args, **_kwargs):
        raise AssertionError("Candidate detection/preprocessing must not run")

    monkeypatch.setattr(service_module, "detect_job_language", detect_job)
    monkeypatch.setattr(service_module, "preprocess_english_job", preprocess_job)
    monkeypatch.setattr(service_module, "detect_language", forbidden, raising=False)
    monkeypatch.setattr(service_module, "preprocess_english", forbidden, raising=False)
    monkeypatch.setattr(service_module, "preprocess_vietnamese", forbidden, raising=False)
    monkeypatch.setattr(service_module, "preprocess_supported", forbidden, raising=False)
    monkeypatch.setattr(language_detector_module, "detect_language", forbidden)
    monkeypatch.setattr(preprocessor_module, "preprocess_english", forbidden)
    monkeypatch.setattr(preprocessor_module, "preprocess_vietnamese", forbidden)
    monkeypatch.setattr(preprocessor_module, "preprocess_supported", forbidden)

    response = rank_candidate_request(_request())

    assert response.results[0].rankingTier is RankingTier.PRIMARY
    assert calls == {"job_detection": 1, "job_preprocessing": 1}


def test_low_confidence_job_performs_no_lexical_work(monkeypatch) -> None:
    def forbidden(*_args, **_kwargs):
        raise AssertionError("FALLBACK-only ranking must not use TF-IDF")

    monkeypatch.setattr(ranker_module, "TfidfVectorizer", forbidden)
    monkeypatch.setattr(service_module, "_preprocess_primary_job", forbidden)
    response = rank_candidate_request(
        _request(
            job_text=LOW_CONFIDENCE_ENGLISH_JOB,
            candidates=[(300, 55, ENGLISH_PROCESSED, ["java"], "en", 1.0)],
            primary_limit=0,
            fallback_limit=100,
        )
    )

    assert response.results[0].rankingTier is RankingTier.FALLBACK
