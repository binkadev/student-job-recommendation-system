"""Focused pure scoring tests for candidate-ranking V2."""

from decimal import Decimal, ROUND_DOWN, localcontext
import math
from types import SimpleNamespace

import numpy as np
import pytest

import v2.candidate_ranker as ranker_module
import v2.candidate_ranking_service as service_module
from v2.candidate_ranking_schemas import (
    CandidateRankingCandidate,
    CandidateRankingJob,
    CandidateRankingRequest,
)
from v2.candidate_ranking_service import rank_candidate_request
from v2.constants import ALGORITHM, CANDIDATE_RANKING_ALGORITHM_VERSION
from v2.language_detector import LanguageDetection
from v2.schemas import LanguageCode, ScoringStrategy
from v2.skill_canonicalizer import load_default_catalog


REQUEST_ID = "f8dd2777-3457-4515-8829-a63599e74775"
ENGLISH_CV = (
    "Software Engineer developed and maintained reliable software services "
    "and REST APIs for users with project experience and knowledge."
)
VIETNAMESE_CV = (
    "Kỹ sư phần mềm có kinh nghiệm phát triển REST API và kiến trúc vi "
    "dịch vụ bằng Java, Spring Boot và PostgreSQL. Đã xây dựng quy trình "
    "CI/CD và triển khai ứng dụng bằng Docker."
)
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
MIXED_TEXT = (
    "Software Engineer developed reliable REST APIs for users. "
    "Kỹ sư phần mềm có kinh nghiệm phát triển dự án cho người dùng."
)
UNKNOWN_TEXT = "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD"
LOW_CONFIDENCE_ENGLISH = "software engineer"


def _request(
    *,
    job_text: str = ENGLISH_JOB,
    job_skills: list[str] | None = None,
    candidates: list[tuple[int, int, str, list[str]]] | None = None,
    threshold: float = 0,
    limit: int = 100,
) -> CandidateRankingRequest:
    if job_skills is None:
        job_skills = ["java", "spring boot", "postgresql", "docker"]
    if candidates is None:
        candidates = [(300, 55, ENGLISH_CV, ["java", "spring boot"])]
    return CandidateRankingRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "job": {"id": 10, "text": job_text, "skills": job_skills},
            "candidates": [
                {
                    "applicationId": application_id,
                    "cvId": cv_id,
                    "text": text,
                    "skills": skills,
                }
                for application_id, cv_id, text, skills in candidates
            ],
            "threshold": threshold,
            "limit": limit,
        }
    )


def _english_detection() -> LanguageDetection:
    return LanguageDetection(LanguageCode.ENGLISH, 1.0, 6, 0)


def _candidate(
    application_id: int,
    cv_id: int,
    text: str = "candidate",
    skills: list[str] | None = None,
) -> CandidateRankingCandidate:
    return CandidateRankingCandidate(
        applicationId=application_id,
        cvId=cv_id,
        text=text,
        skills=[] if skills is None else skills,
    )


def _job(
    text: str = "selected job",
    skills: list[str] | None = None,
) -> CandidateRankingJob:
    return CandidateRankingJob(
        id=10,
        text=text,
        skills=[] if skills is None else skills,
    )


def _direct_rank(
    *,
    job: CandidateRankingJob,
    same: tuple[tuple[CandidateRankingCandidate, LanguageDetection], ...] = (),
    cross: tuple[tuple[CandidateRankingCandidate, LanguageDetection], ...] = (),
    threshold: Decimal = Decimal("0"),
    limit: int = 100,
):
    return ranker_module.rank_candidates(
        job=job,
        job_detection=_english_detection(),
        same_language_candidates=same,
        cross_language_candidates=cross,
        threshold=threshold,
        limit=limit,
        catalog=load_default_catalog(),
    )


def test_english_job_and_candidate_use_same_language_hybrid() -> None:
    result = rank_candidate_request(_request()).results[0]

    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.textScore is not None
    assert result.skillScore == 0.5
    assert result.matchedSkills == ["java", "spring boot"]
    assert result.missingSkills == ["docker", "postgresql"]


def test_vietnamese_job_and_candidate_use_same_language_hybrid() -> None:
    result = rank_candidate_request(
        _request(
            job_text=VIETNAMESE_JOB,
            candidates=[(301, 56, VIETNAMESE_CV, ["java", "spring boot"])],
        )
    ).results[0]

    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.textScore is not None


@pytest.mark.parametrize(
    "candidate_text",
    [VIETNAMESE_CV, MIXED_TEXT, UNKNOWN_TEXT, LOW_CONFIDENCE_ENGLISH],
    ids=["mismatch", "mixed", "unknown", "low-confidence"],
)
def test_nonconfident_or_mismatched_candidate_uses_skill_only(
    candidate_text: str,
) -> None:
    result = rank_candidate_request(
        _request(
            job_skills=["java"],
            candidates=[(302, 57, candidate_text, ["java"])],
        )
    ).results[0]

    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.score == result.skillScore == 1.0


def test_low_confidence_job_makes_all_candidates_skill_only() -> None:
    response = rank_candidate_request(
        _request(
            job_text=LOW_CONFIDENCE_ENGLISH,
            candidates=[
                (303, 58, ENGLISH_CV, ["java"]),
                (304, 59, VIETNAMESE_CV, ["java"]),
            ],
        )
    )

    assert len(response.results) == 2
    assert all(
        result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
        and result.textScore is None
        for result in response.results
    )


def test_language_detection_is_one_job_call_and_one_call_per_candidate(
    monkeypatch,
) -> None:
    counts = {"job": 0, "candidate": 0}
    real_job_detection = service_module.detect_job_language
    real_candidate_detection = service_module.detect_language

    def detect_job(text: str):
        counts["job"] += 1
        return real_job_detection(text)

    def detect_candidate(text: str):
        counts["candidate"] += 1
        return real_candidate_detection(text)

    monkeypatch.setattr(service_module, "detect_job_language", detect_job)
    monkeypatch.setattr(service_module, "detect_language", detect_candidate)

    rank_candidate_request(
        _request(
            candidates=[
                (305, 60, ENGLISH_CV, []),
                (306, 61, VIETNAMESE_CV, []),
                (307, 62, UNKNOWN_TEXT, []),
            ]
        )
    )

    assert counts == {"job": 1, "candidate": 3}


def test_aliases_canonicalize_and_overlap_lists_are_complete_sorted() -> None:
    result = rank_candidate_request(
        _request(
            job_skills=["Java", "cơ sở dữ liệu", "Docker"],
            candidates=[(308, 63, VIETNAMESE_CV, ["java", "database"])],
        )
    ).results[0]

    assert result.matchedSkills == ["database", "java"]
    assert result.missingSkills == ["docker"]


def test_skill_denominator_is_canonical_job_skill_count() -> None:
    result = rank_candidate_request(
        _request(
            job_text=VIETNAMESE_JOB,
            job_skills=["java", "docker", "python"],
            candidates=[(309, 64, VIETNAMESE_CV, ["java"])],
        )
    ).results[0]

    assert result.skillScore == pytest.approx(1 / 3, abs=1e-8)
    assert result.score == pytest.approx(
        0.65 * result.textScore + 0.35 * result.skillScore,
        abs=1e-8,
    )


def test_no_job_skills_has_zero_skill_score() -> None:
    result = rank_candidate_request(
        _request(job_skills=[], candidates=[(310, 65, ENGLISH_CV, [])])
    ).results[0]

    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.skillScore == 0.0
    assert result.score == result.textScore


def test_one_hundred_matching_job_skills_are_all_returned() -> None:
    job_skills = [f"skill-{index:03d}" for index in range(100)]
    response = rank_candidate_request(
        _request(
            job_skills=job_skills,
            candidates=[(311, 66, ENGLISH_CV, job_skills)],
        )
    )
    result = response.results[0]

    assert len(result.matchedSkills) == 100
    assert len(result.missingSkills) == 0
    assert result.matchedSkills == sorted(job_skills)
    assert result.missingSkills == []


def test_one_hundred_missing_job_skills_are_all_returned_without_truncation() -> None:
    job_skills = [f"skill-{index:03d}" for index in range(100)]
    response = rank_candidate_request(
        _request(
            job_skills=job_skills,
            candidates=[(312, 67, ENGLISH_CV, [])],
        )
    )
    result = response.results[0]

    assert len(result.matchedSkills) == 0
    assert len(result.missingSkills) == 100
    assert result.matchedSkills == []
    assert result.missingSkills == sorted(job_skills)


class _SpyVectorizer:
    instances: list["_SpyVectorizer"] = []

    def __init__(self, **configuration) -> None:
        self.configuration = configuration
        self.fit_documents: list[str] | None = None
        self.transform_documents: list[str] | None = None
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
        return np.ones((1, len(self.fit_documents or [])))


def test_reverse_tfidf_fits_complete_candidate_corpus_and_transforms_job_once(
    monkeypatch,
) -> None:
    _SpyVectorizer.instances.clear()
    monkeypatch.setattr(ranker_module, "TfidfVectorizer", _SpyVectorizer)
    request = _request(
        candidates=[
            (312, 67, ENGLISH_CV, []),
            (313, 68, ENGLISH_CV + " unique candidate evidence", []),
            (314, 69, VIETNAMESE_CV, []),
        ]
    )

    response = rank_candidate_request(request)
    vectorizer = _SpyVectorizer.instances[0]

    assert len(response.results) == 3
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
    assert vectorizer.transform_calls == 1
    assert len(vectorizer.fit_documents) == 2
    assert "unique candidate evidence" in vectorizer.fit_documents[1]
    assert all("backend" not in document for document in vectorizer.fit_documents)
    assert len(vectorizer.transform_documents) == 1
    assert "backend" in vectorizer.transform_documents[0]
    assert "unique candidate evidence" not in vectorizer.transform_documents[0]


def test_cross_language_candidates_do_not_enter_same_language_tfidf_corpus(
    monkeypatch,
) -> None:
    monkeypatch.setattr(ranker_module, "TfidfVectorizer", _SpyVectorizer)
    _SpyVectorizer.instances.clear()
    rank_candidate_request(
        _request(
            candidates=[
                (315, 70, ENGLISH_CV, []),
                (316, 71, VIETNAMESE_CV, []),
            ]
        )
    )

    vectorizer = _SpyVectorizer.instances[0]
    assert len(vectorizer.fit_documents) == 1
    assert "kinh_nghiệm" not in vectorizer.fit_documents[0]


def test_adding_same_language_candidate_changes_shared_idf(monkeypatch) -> None:
    def fake_candidate(text, *, detection):
        return SimpleNamespace(processed_text=text)

    def fake_job(text, *, detection):
        return SimpleNamespace(processed_text=text)

    monkeypatch.setattr(ranker_module, "preprocess_english", fake_candidate)
    monkeypatch.setattr(ranker_module, "preprocess_english_job", fake_job)
    candidate_one = (_candidate(317, 72, "alpha target"), _english_detection())
    candidate_two = (_candidate(318, 73, "alpha"), _english_detection())
    job = _job(text="target")

    without_extra = _direct_rank(job=job, same=(candidate_one,))[0].text_score
    with_extra = _direct_rank(
        job=job,
        same=(candidate_one, candidate_two),
    )[0].text_score

    assert with_extra != without_extra


def test_empty_candidate_vocabulary_returns_zero_text_score(monkeypatch) -> None:
    def empty_preprocess(text, *, detection):
        return SimpleNamespace(processed_text="")

    monkeypatch.setattr(ranker_module, "preprocess_english", empty_preprocess)
    monkeypatch.setattr(ranker_module, "preprocess_english_job", empty_preprocess)
    result = _direct_rank(
        job=_job(skills=[]),
        same=((_candidate(319, 74, "ignored", []), _english_detection()),),
    )[0]

    assert result.text_score == Decimal("0.00000000")
    assert result.skill_score == Decimal("0.00000000")
    assert result.score == Decimal("0.00000000")
    assert math.isfinite(float(result.score))


def test_nonfinite_cosine_similarity_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr(
        ranker_module,
        "cosine_similarity",
        lambda _job, _candidates: np.array([[math.nan]]),
    )

    with pytest.raises(ValueError, match="must be finite"):
        _direct_rank(
            job=_job(skills=[]),
            same=((_candidate(320, 75, ENGLISH_CV), _english_detection()),),
        )


def test_weighted_formula_projects_raw_components_once() -> None:
    result = _direct_rank(
        job=_job(skills=["java", "python"]),
        same=(
            (
                _candidate(321, 76, ENGLISH_CV, ["java"]),
                _english_detection(),
            ),
        ),
    )
    # This test uses the real text score only for routing; the exact raw-score
    # arithmetic is locked separately with a deterministic text-score spy.
    assert result[0].scoring_strategy is ScoringStrategy.SAME_LANGUAGE_HYBRID


@pytest.mark.parametrize(
    ("raw_text", "expected"),
    [
        (0.4, Decimal("0.43500000")),
        (0.123456785, Decimal("0.31358024")),
    ],
)
def test_weighted_formula_uses_raw_unrounded_components(
    monkeypatch,
    raw_text: float,
    expected: Decimal,
) -> None:
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda **_kwargs: (raw_text,),
    )
    response = rank_candidate_request(
        _request(
            job_skills=["java", "python", "go"]
            if raw_text != 0.4
            else ["java", "python"],
            candidates=[
                (
                    322,
                    77,
                    ENGLISH_CV,
                    ["java"] if raw_text == 0.4 else ["java", "python"],
                )
            ],
        )
    )

    assert Decimal(str(response.results[0].score)).quantize(
        Decimal("0.00000001")
    ) == expected


def test_same_language_no_skill_branch_uses_text_score() -> None:
    result = rank_candidate_request(
        _request(job_skills=[], candidates=[(323, 78, ENGLISH_CV, [])])
    ).results[0]

    assert result.skillScore == 0.0
    assert result.score == result.textScore


def test_cross_language_skill_only_and_no_skill_branches() -> None:
    with_skills = rank_candidate_request(
        _request(
            candidates=[(324, 79, VIETNAMESE_CV, ["java"])],
            job_skills=["java", "docker"],
        )
    ).results[0]
    without_skills = rank_candidate_request(
        _request(
            candidates=[(325, 80, VIETNAMESE_CV, ["java"])],
            job_skills=[],
        )
    ).results[0]

    assert with_skills.textScore is None
    assert with_skills.score == with_skills.skillScore == 0.5
    assert without_skills.textScore is None
    assert without_skills.skillScore == without_skills.score == 0.0


def test_public_scores_have_at_most_eight_decimal_places_and_ignore_context(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda **_kwargs: (0.123456785,),
    )
    with localcontext() as context:
        context.prec = 4
        context.rounding = ROUND_DOWN
        result = rank_candidate_request(
            _request(
                job_skills=["java", "python", "go"],
                candidates=[(326, 81, ENGLISH_CV, ["java", "python"])],
            )
        ).results[0]

    assert result.textScore == 0.12345679
    assert result.skillScore == 0.66666667
    assert result.score == 0.31358024
    for value in (result.score, result.textScore, result.skillScore):
        assert len(str(value).split(".")[1]) <= 8


def test_threshold_equality_is_included_and_below_threshold_is_excluded(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda **_kwargs: (0.099999995, 0.099999994),
    )
    response = rank_candidate_request(
        _request(
            job_skills=[],
            threshold=0.1,
            candidates=[
                (327, 82, ENGLISH_CV, []),
                (328, 83, ENGLISH_CV, []),
            ],
        )
    )

    assert [(result.applicationId, result.score) for result in response.results] == [
        (327, 0.1)
    ]


def test_top_k_is_global_after_strategy_combination_and_ties_are_deterministic(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        ranker_module,
        "_reverse_text_scores",
        lambda **_kwargs: (0.4, 0.4),
    )
    request = _request(
        limit=3,
        candidates=[
            (330, 85, VIETNAMESE_CV, ["java"]),
            (329, 84, ENGLISH_CV, ["java"]),
            (331, 86, VIETNAMESE_CV, ["java"]),
            (332, 87, ENGLISH_CV, ["java"]),
        ],
        job_skills=["java"],
    )

    response = rank_candidate_request(request)

    # Cross-language scores are 1.0 and precede the same-language 0.61 score;
    # equal cross-language scores are ordered by applicationId.
    assert [result.applicationId for result in response.results] == [330, 331, 329]
    assert [(result.applicationId, result.cvId) for result in response.results] == [
        (330, 85),
        (331, 86),
        (329, 84),
    ]


def test_input_order_does_not_change_global_output() -> None:
    candidates = [
        (333, 88, VIETNAMESE_CV, ["java"]),
        (334, 89, ENGLISH_CV, ["java"]),
        (335, 90, UNKNOWN_TEXT, ["java"]),
    ]
    first = rank_candidate_request(
        _request(candidates=candidates, job_skills=["java"])
    ).model_dump(mode="json")
    second = rank_candidate_request(
        _request(candidates=list(reversed(candidates)), job_skills=["java"])
    ).model_dump(mode="json")

    assert first == second


def test_candidate_response_contains_exact_metadata_and_no_reason_or_rank() -> None:
    response = rank_candidate_request(_request())

    assert response.algorithm == ALGORITHM == "tfidf-cosine-hybrid"
    assert response.algorithmVersion == CANDIDATE_RANKING_ALGORITHM_VERSION
    assert set(response.model_dump()) == {
        "requestId",
        "algorithm",
        "algorithmVersion",
        "results",
    }
    assert set(response.results[0].model_dump()) == {
        "applicationId",
        "cvId",
        "score",
        "textScore",
        "skillScore",
        "scoringStrategy",
        "matchedSkills",
        "missingSkills",
    }
    response_json = response.model_dump_json()
    assert "reason" not in response_json
    assert "rankPosition" not in response_json


def test_existing_recommendation_metadata_remains_distinct() -> None:
    from v2.constants import ALGORITHM_VERSION

    assert ALGORITHM_VERSION == "bilingual-recommendation-v2"
    assert CANDIDATE_RANKING_ALGORITHM_VERSION == (
        "bilingual-candidate-ranking-v2"
    )
