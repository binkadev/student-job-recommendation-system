"""Tests for the pure Phase 1B.2 English-baseline service boundary."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace

import pytest

import v2.service as service_module
from v2.constants import ALGORITHM, ALGORITHM_VERSION
from v2.language_detector import LanguageDetection
from v2.preprocessor import (
    EnglishPreprocessingResult,
)
from v2.schemas import (
    LanguageCode,
    RecommendationRequest,
    RecommendationResponse,
    ScoringStrategy,
)
from v2.service import (
    recommend_english,
)


REQUEST_ID = "e5887544-9785-4697-8345-74953da1c2a7"
ENGLISH_CV_TEXT = (
    "We have experience and knowledge to design and develop reliable "
    "software projects for our users."
)
ENGLISH_JOB_TEXT = (
    "TITLE:\n"
    "Backend Developer\n"
    "DESCRIPTION:\n"
    "We develop and maintain reliable software services for our users.\n"
    "REQUIREMENTS:\n"
    "You have experience with backend projects.\n"
    "SKILLS:\n"
    "Java\n"
    "Spring Boot"
)


def _request(
    *,
    cv_text: str = ENGLISH_CV_TEXT,
    cv_skills: list[str] | None = None,
    job_texts: list[str] | None = None,
    job_skills: list[list[str]] | None = None,
    threshold: float = 0.0,
    limit: int = 100,
) -> RecommendationRequest:
    texts = job_texts if job_texts is not None else [ENGLISH_JOB_TEXT]
    skills = job_skills if job_skills is not None else [["Java"]]
    return RecommendationRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "cv": {
                "id": 7,
                "text": cv_text,
                "skills": cv_skills if cv_skills is not None else ["Java"],
            },
            "jobs": [
                {
                    "id": 100 + index,
                    "text": text,
                    "skills": skills[index],
                }
                for index, text in enumerate(texts)
            ],
            "threshold": threshold,
            "limit": limit,
        }
    )


def _english_result(
    processed_text: str = "prepared english",
) -> EnglishPreprocessingResult:
    return EnglishPreprocessingResult(
        processed_text=processed_text,
        tokens=tuple(processed_text.split()),
        language=LanguageDetection(
            language_code=LanguageCode.ENGLISH,
            confidence=1.0,
            english_signal_count=6,
            vietnamese_signal_count=0,
        ),
    )


def _raise_if_called(*_args, **_kwargs):
    pytest.fail("empty Jobs must return before any Phase 1B.2 dependency")


def test_empty_jobs_returns_valid_metadata_before_loading_or_detection(
    monkeypatch,
) -> None:
    request = _request(job_texts=[], job_skills=[])
    monkeypatch.setattr(
        service_module,
        "preprocess_english",
        _raise_if_called,
    )
    monkeypatch.setattr(
        service_module,
        "preprocess_english_job",
        _raise_if_called,
    )
    monkeypatch.setattr(
        service_module,
        "load_default_catalog",
        _raise_if_called,
    )
    monkeypatch.setattr(
        service_module,
        "score_same_language_recommendations",
        _raise_if_called,
    )

    response = recommend_english(request)

    assert isinstance(response, RecommendationResponse)
    assert response.model_dump(mode="json") == {
        "requestId": REQUEST_ID,
        "algorithm": ALGORITHM,
        "algorithmVersion": ALGORITHM_VERSION,
        "results": [],
    }


def test_service_loads_catalog_once_and_scores_complete_canonical_sets(
    monkeypatch,
) -> None:
    matching = [f"skill-{index:03d}" for index in range(130)]
    missing = [f"missing-{index:03d}" for index in range(120)]
    cv_skills = matching + [
        "Go",
        "Golang",
        "K8s",
        "Kubernetes",
        "SpringBoot",
    ]
    job_skill_values = matching + missing + [
        "go",
        "Kubernetes",
        "spring boot",
    ]
    request = _request(
        cv_text="we are with our",
        cv_skills=cv_skills,
        job_texts=["we are with our"],
        job_skills=[job_skill_values],
    )

    real_loader = service_module.load_default_catalog
    real_scorer = service_module.score_same_language_recommendations
    loader_calls = 0
    captured: dict = {}

    def counted_loader():
        nonlocal loader_calls
        loader_calls += 1
        return real_loader()

    def capturing_scorer(**kwargs):
        captured.update(kwargs)
        return real_scorer(**kwargs)

    monkeypatch.setattr(
        service_module,
        "load_default_catalog",
        counted_loader,
    )
    monkeypatch.setattr(
        service_module,
        "score_same_language_recommendations",
        capturing_scorer,
    )

    response = recommend_english(request)

    expected_cv = frozenset(matching + ["go", "kubernetes", "spring boot"])
    expected_job = frozenset(
        matching + missing + ["go", "kubernetes", "spring boot"]
    )
    assert loader_calls == 1
    assert captured["cv_canonical_skills"] == expected_cv
    assert captured["jobs"][0].canonical_skills == expected_job
    assert captured["cv_processed_text"] == ""
    assert captured["jobs"][0].processed_text == ""
    assert captured["threshold"] == Decimal("0.0")
    assert captured["limit"] == 100

    result = response.results[0]
    assert result.textScore == 0.0
    assert result.skillScore == pytest.approx(133 / 253, abs=1e-8)
    assert result.score == pytest.approx(0.35 * (133 / 253), abs=1e-8)
    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.matchedSkills == sorted(expected_cv)[:100]
    assert result.missingSkills == sorted(set(missing))[:100]
    assert len(result.matchedSkills) == 100
    assert len(result.missingSkills) == 100


def test_response_projects_decimal_candidates_to_strict_floats_and_caps_each_array(
    monkeypatch,
) -> None:
    matched = tuple(reversed([f"matched-{index:03d}" for index in range(121)]))
    missing = tuple(reversed([f"missing-{index:03d}" for index in range(131)]))

    monkeypatch.setattr(
        service_module,
        "preprocess_english",
        lambda _text: _english_result("cv prepared"),
    )
    monkeypatch.setattr(
        service_module,
        "preprocess_english_job",
        lambda _text: _english_result("job prepared"),
    )
    monkeypatch.setattr(
        service_module,
        "score_same_language_recommendations",
        lambda **_kwargs: (
            SimpleNamespace(
                job_id=100,
                score=Decimal("0.62500000"),
                text_score=Decimal("0.50000000"),
                skill_score=Decimal("0.85714286"),
                full_matched_skills=matched,
                full_missing_skills=missing,
                reason="Deterministic same-language evidence.",
            ),
        ),
    )

    response = recommend_english(_request())
    result = response.results[0]

    assert isinstance(result.score, float)
    assert isinstance(result.textScore, float)
    assert isinstance(result.skillScore, float)
    assert result.matchedSkills == sorted(matched)[:100]
    assert result.missingSkills == sorted(missing)[:100]
    assert set(result.model_dump()) == {
        "jobId",
        "score",
        "textScore",
        "skillScore",
        "scoringStrategy",
        "matchedSkills",
        "missingSkills",
        "reason",
    }
    assert "rank" not in result.model_dump()
    assert "rankPosition" not in result.model_dump()


def test_actual_service_response_is_schema_valid_and_deterministic() -> None:
    request = _request(
        cv_skills=["Java", "Golang"],
        job_texts=[
            ENGLISH_JOB_TEXT,
            ENGLISH_JOB_TEXT.replace("Backend", "Platform"),
        ],
        job_skills=[
            ["Java", "Go", "Docker"],
            ["Java", "Kubernetes"],
        ],
    )

    first = recommend_english(request)
    second = recommend_english(request)

    assert isinstance(first, RecommendationResponse)
    assert first.model_dump(mode="json") == second.model_dump(mode="json")
    RecommendationResponse.model_validate(first.model_dump(mode="python"))
    for result in first.results:
        assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
        assert "rank" not in result.model_dump()
        assert "rankPosition" not in result.model_dump()


def test_english_service_golden_output_remains_exact() -> None:
    response = recommend_english(
        _request(
            cv_skills=["Java", "Golang"],
            job_skills=[["Java", "Go", "Docker"]],
        )
    )

    assert response.model_dump(mode="json") == {
        "requestId": REQUEST_ID,
        "algorithm": "tfidf-cosine-hybrid",
        "algorithmVersion": "bilingual-recommendation-v2",
        "results": [
            {
                "jobId": 100,
                "score": 0.60109824,
                "textScore": 0.56579216,
                "skillScore": 0.66666667,
                "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                "matchedSkills": ["go", "java"],
                "missingSkills": ["docker"],
                "reason": (
                    "Matched 2 of 3 job skills: go, java. "
                    "Missing job skills: 1. "
                    "Same-language text similarity: 56.579216%. "
                    "Canonical skill coverage: 66.666667%."
                ),
            }
        ],
    }


@pytest.mark.parametrize(
    "cv_text",
    [
        "Kỹ sư phần mềm Java Spring Boot PostgreSQL",
        "Software Engineer developed REST APIs. Kỹ sư phần mềm.",
        "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD",
        "This is Java.",
    ],
)
def test_non_confident_or_unsafe_cv_uses_skill_only_fallback(
    cv_text: str,
) -> None:
    response = recommend_english(
        _request(
            cv_text=cv_text,
            cv_skills=["Java"],
            job_texts=[ENGLISH_JOB_TEXT],
            job_skills=[["Java"]],
        )
    )

    result = response.results[0]
    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.score == result.skillScore == 1.0


@pytest.mark.parametrize(
    "job_text",
    [
        "Kỹ sư phần mềm phát triển dự án và có kinh nghiệm.",
        "Software Engineer developed REST APIs. Kỹ sư phần mềm.",
        "Java Spring Boot PostgreSQL Docker",
        "This is Java.",
    ],
)
def test_unsafe_job_uses_skill_only_strategy_without_failing(
    job_text: str,
) -> None:
    request = _request(
        job_texts=[job_text],
        job_skills=[["Java", "Docker"]],
    )

    result = recommend_english(request).results[0]

    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.skillScore == 0.5
    assert result.score == result.skillScore


def test_unknown_cv_uses_skill_only_for_every_job() -> None:
    response = recommend_english(
        _request(
            cv_text="Java Spring Boot PostgreSQL Docker",
            cv_skills=["Java"],
            job_texts=[ENGLISH_JOB_TEXT],
            job_skills=[["Java"]],
        )
    )

    assert response.results[0].scoringStrategy is (
        ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    )
    assert response.results[0].textScore is None
    assert response.results[0].score == 1.0


@pytest.mark.parametrize(
    ("cv_text", "job_text"),
    [
        ("we are with our", ENGLISH_JOB_TEXT),
        (ENGLISH_CV_TEXT, "we are with our"),
        ("we are with our", "we are with our"),
    ],
)
def test_blank_prepared_documents_and_zero_vectors_preserve_skill_scoring(
    cv_text: str,
    job_text: str,
) -> None:
    response = recommend_english(
        _request(
            cv_text=cv_text,
            cv_skills=["Java"],
            job_texts=[job_text],
            job_skills=[["Java"]],
        )
    )

    result = response.results[0]
    if cv_text == "we are with our" or job_text == "we are with our":
        assert result.textScore == 0.0
    assert result.skillScore == 1.0
    assert result.score == 0.35
