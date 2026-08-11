"""Focused routing, scoring, ordering, and pipeline tests for Student V3."""

from decimal import Decimal
from types import SimpleNamespace

import numpy as np
import pytest

import v2.language_detector as language_detector_module
import v2.preprocessor as preprocessor_module
import v2.recommender as v2_recommender_module
import v3.service as service_module
from v2.language_detector import LanguageDetection, detect_job_language
from v2.schemas import LanguageCode, ScoringStrategy
from v3.constants import PROCESSING_VERSION
from v3.schemas import RankingTier, RecommendationRequest
from v3.service import recommend_students


REQUEST_ID = "8ab8a761-8b52-42a6-b589-8a291670f831"
ENGLISH_PROCESSED_CV = "software engineer developed reliable service java spring_boot"
VIETNAMESE_PROCESSED_CV = "kỹ_sư_phần_mềm kinh_nghiệm phát_triển java spring_boot"
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
MIXED_JOB = (
    "Software Engineer developed reliable REST APIs for users. "
    "Kỹ sư phần mềm có kinh nghiệm phát triển dự án cho người dùng."
)
UNKNOWN_JOB = "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD"
LOW_CONFIDENCE_ENGLISH_JOB = "TITLE:\nWe develop"


def _request(
    *,
    cv_language: str = "en",
    cv_confidence: float = 1.0,
    cv_text: str = ENGLISH_PROCESSED_CV,
    cv_skills: list[str] | None = None,
    jobs: list[tuple[int, str, list[str]]] | None = None,
    threshold: float = 0,
    limit: int = 100,
) -> RecommendationRequest:
    if cv_skills is None:
        cv_skills = ["java", "spring boot"]
    if jobs is None:
        jobs = [(10, ENGLISH_JOB, ["java", "spring boot"])]
    return RecommendationRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "cv": {
                "id": 55,
                "processedText": cv_text,
                "skills": cv_skills,
                "languageCode": cv_language,
                "languageConfidence": cv_confidence,
                "processingVersion": PROCESSING_VERSION,
            },
            "jobs": [
                {"id": job_id, "text": text, "skills": skills}
                for job_id, text, skills in jobs
            ],
            "threshold": threshold,
            "limit": limit,
        }
    )


@pytest.mark.parametrize(
    ("cv_language", "cv_text", "job_text"),
    [
        ("en", ENGLISH_PROCESSED_CV, ENGLISH_JOB),
        ("vi", VIETNAMESE_PROCESSED_CV, VIETNAMESE_JOB),
    ],
)
def test_confident_same_language_pairs_are_primary(
    cv_language: str,
    cv_text: str,
    job_text: str,
) -> None:
    result = recommend_students(
        _request(cv_language=cv_language, cv_text=cv_text, jobs=[(10, job_text, ["java"])])
    ).results[0]

    assert result.rankingTier is RankingTier.PRIMARY
    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.textScore is not None
    assert result.overallScore == result.rankingScore


@pytest.mark.parametrize(
    ("cv_language", "cv_text", "job_text"),
    [
        ("vi", VIETNAMESE_PROCESSED_CV, ENGLISH_JOB),
        ("en", ENGLISH_PROCESSED_CV, VIETNAMESE_JOB),
    ],
)
def test_confident_cross_language_pairs_are_fallback(
    cv_language: str,
    cv_text: str,
    job_text: str,
) -> None:
    result = recommend_students(
        _request(cv_language=cv_language, cv_text=cv_text, jobs=[(10, job_text, ["java"])])
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK
    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.overallScore is None


def test_low_confidence_cv_is_fallback() -> None:
    result = recommend_students(
        _request(cv_confidence=0.64999999, jobs=[(10, ENGLISH_JOB, ["java"])])
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK


def test_low_confidence_job_is_fallback() -> None:
    detection = detect_job_language(LOW_CONFIDENCE_ENGLISH_JOB)
    assert detection.confidence < 0.65

    result = recommend_students(
        _request(jobs=[(10, LOW_CONFIDENCE_ENGLISH_JOB, ["java"])])
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK


@pytest.mark.parametrize("language_code", ["mixed", "unknown"])
def test_unsupported_persisted_cv_language_is_fallback(language_code: str) -> None:
    result = recommend_students(
        _request(cv_language=language_code, jobs=[(10, ENGLISH_JOB, ["java"])])
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK


@pytest.mark.parametrize("job_text", [MIXED_JOB, UNKNOWN_JOB])
def test_mixed_or_unknown_job_language_is_fallback(job_text: str) -> None:
    result = recommend_students(
        _request(jobs=[(10, job_text, ["java"])])
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK


def test_primary_hybrid_formula_uses_locked_decimal_projection(monkeypatch) -> None:
    monkeypatch.setattr(
        v2_recommender_module,
        "_calculate_text_scores",
        lambda _cv, jobs: tuple(0.4 for _job in jobs),
    )

    result = recommend_students(
        _request(cv_skills=["java"], jobs=[(10, ENGLISH_JOB, ["java", "docker"])])
    ).results[0]

    assert result.textScore == 0.4
    assert result.skillScore == 0.5
    assert result.overallScore == result.rankingScore == 0.435


def test_primary_formula_uses_raw_unrounded_components(monkeypatch) -> None:
    monkeypatch.setattr(
        v2_recommender_module,
        "_calculate_text_scores",
        lambda _cv, jobs: tuple(0.123456785 for _job in jobs),
    )

    result = recommend_students(
        _request(
            cv_skills=["java", "docker"],
            jobs=[(10, ENGLISH_JOB, ["java", "docker", "postgresql"])],
        )
    ).results[0]

    assert result.textScore == 0.12345679
    assert result.skillScore == 0.66666667
    assert result.overallScore == result.rankingScore == 0.31358024


def test_primary_job_without_skills_is_text_only(monkeypatch) -> None:
    monkeypatch.setattr(
        v2_recommender_module,
        "_calculate_text_scores",
        lambda _cv, jobs: tuple(0.4 for _job in jobs),
    )

    result = recommend_students(_request(jobs=[(10, ENGLISH_JOB, [])])).results[0]

    assert result.skillScore == 0.0
    assert result.textScore == 0.4
    assert result.overallScore == result.rankingScore == result.textScore


def test_fallback_full_job_skill_coverage_is_not_an_overall_score() -> None:
    skills = ["java", "spring boot", "postgresql", "docker"]
    result = recommend_students(
        _request(
            cv_language="vi",
            cv_text=VIETNAMESE_PROCESSED_CV,
            cv_skills=skills,
            jobs=[(10, ENGLISH_JOB, skills)],
        )
    ).results[0]

    assert result.rankingScore == result.skillScore == 1.0
    assert result.textScore is None
    assert result.overallScore is None
    assert "Không sử dụng độ tương đồng văn bản" in result.reason
    assert "overall" not in result.reason.casefold()


def test_threshold_zero_retains_skillless_zero_score_fallback() -> None:
    result = recommend_students(
        _request(
            cv_language="vi",
            cv_text=VIETNAMESE_PROCESSED_CV,
            jobs=[(10, ENGLISH_JOB, [])],
            threshold=0,
        )
    ).results[0]

    assert result.rankingTier is RankingTier.FALLBACK
    assert result.rankingScore == result.skillScore == 0.0


def test_fallback_threshold_is_inclusive_on_projected_public_score() -> None:
    arguments = {
        "cv_language": "vi",
        "cv_text": VIETNAMESE_PROCESSED_CV,
        "cv_skills": ["java"],
        "jobs": [(10, ENGLISH_JOB, ["java", "docker", "postgresql"])],
    }

    equal = recommend_students(_request(**arguments, threshold=0.33333333))
    higher = recommend_students(_request(**arguments, threshold=0.33333334))

    assert equal.results[0].rankingScore == 0.33333333
    assert higher.results == []


def test_tier_ordering_internal_scores_ties_and_global_limit(monkeypatch) -> None:
    primary_scores = {20: 0.4, 19: 0.8, 18: 0.8}
    monkeypatch.setattr(
        v2_recommender_module,
        "_calculate_text_scores",
        lambda _cv, jobs: tuple(primary_scores[job.job_id] for job in jobs),
    )
    request = _request(
        cv_skills=["java"],
        jobs=[
            (20, ENGLISH_JOB, []),
            (40, VIETNAMESE_JOB, ["java"]),
            (19, ENGLISH_JOB, []),
            (41, VIETNAMESE_JOB, ["java", "docker"]),
            (18, ENGLISH_JOB, []),
            (39, VIETNAMESE_JOB, ["java"]),
        ],
        limit=5,
    )

    results = recommend_students(request).results

    assert [result.jobId for result in results] == [18, 19, 20, 39, 40]
    assert [result.rankingTier for result in results] == [
        RankingTier.PRIMARY,
        RankingTier.PRIMARY,
        RankingTier.PRIMARY,
        RankingTier.FALLBACK,
        RankingTier.FALLBACK,
    ]
    assert results[2].rankingScore == 0.4
    assert results[3].rankingScore == 1.0


def test_fallback_orders_by_score_then_job_id() -> None:
    results = recommend_students(
        _request(
            cv_language="vi",
            cv_text=VIETNAMESE_PROCESSED_CV,
            cv_skills=["java"],
            jobs=[
                (40, ENGLISH_JOB, ["java"]),
                (41, ENGLISH_JOB, ["java", "docker"]),
                (39, ENGLISH_JOB, ["java"]),
            ],
        )
    ).results

    assert [result.jobId for result in results] == [39, 40, 41]
    assert [result.rankingScore for result in results] == [1.0, 1.0, 0.5]


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


def test_complete_primary_corpus_fits_once_and_verbatim_cv_transforms_once(
    monkeypatch,
) -> None:
    _SpyVectorizer.instances.clear()
    monkeypatch.setattr(v2_recommender_module, "TfidfVectorizer", _SpyVectorizer)
    persisted_text = "  exact persisted_cv tokens  \n"

    recommend_students(
        _request(
            cv_text=persisted_text,
            jobs=[
                (30, ENGLISH_JOB + " one", []),
                (31, ENGLISH_JOB + " two", []),
                (32, ENGLISH_JOB + " three", []),
            ],
            limit=1,
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
    assert len(vectorizer.fit_documents) == 3
    assert vectorizer.transform_calls == 1
    assert vectorizer.transform_documents == [persisted_text]


def test_cv_language_detection_and_preprocessing_are_never_invoked(monkeypatch) -> None:
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
        raise AssertionError("CV detection/preprocessing must not be invoked")

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

    response = recommend_students(_request(jobs=[(10, ENGLISH_JOB, [])]))

    assert response.results[0].rankingTier is RankingTier.PRIMARY
    assert calls == {"job_detection": 1, "job_preprocessing": 1}
