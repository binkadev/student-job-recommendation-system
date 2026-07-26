"""Bilingual strategy, scoring, isolation, and contract regression tests."""

from decimal import Decimal
from uuid import UUID

import pytest

from v2.language_detector import detect_job_language, detect_language
from v2.preprocessor import preprocess_vietnamese, preprocess_vietnamese_job
from v2.schemas import RecommendationRequest, ScoringStrategy
from v2.service import recommend_english


REQUEST_ID = "8ab8a761-8b52-42a6-b589-8a291670f831"
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
MIXED_JOB = (
    "Software Engineer developed reliable REST APIs for users. "
    "Kỹ sư phần mềm có kinh nghiệm phát triển dự án cho người dùng."
)
UNKNOWN_JOB = "Java Spring Boot PostgreSQL Docker C++ .NET Node.js CI/CD"


def _request(
    *,
    cv_text: str,
    cv_skills: list[str],
    jobs: list[tuple[int, str, list[str]]],
    threshold: float = 0,
    limit: int = 100,
) -> RecommendationRequest:
    return RecommendationRequest.model_validate(
        {
            "requestId": REQUEST_ID,
            "cv": {"id": 1, "text": cv_text, "skills": cv_skills},
            "jobs": [
                {"id": job_id, "text": text, "skills": skills}
                for job_id, text, skills in jobs
            ],
            "threshold": threshold,
            "limit": limit,
        }
    )


def _result_by_id(response) -> dict[int, object]:
    return {result.jobId: result for result in response.results}


def test_vietnamese_same_language_uses_hybrid_and_vietnamese_reason() -> None:
    response = recommend_english(
        _request(
            cv_text=VIETNAMESE_CV,
            cv_skills=["Java", "Spring Boot", "PostgreSQL"],
            jobs=[
                (
                    10,
                    VIETNAMESE_JOB,
                    ["Java", "Spring Boot", "PostgreSQL", "Docker"],
                )
            ],
        )
    )
    result = response.results[0]

    assert result.scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert result.textScore is not None
    assert result.skillScore == 0.75
    assert result.score == pytest.approx(
        0.65 * result.textScore + 0.35 * result.skillScore,
        abs=1e-8,
    )
    assert result.matchedSkills == ["java", "postgresql", "spring boot"]
    assert result.missingSkills == ["docker"]
    assert "Đã khớp" in result.reason
    assert "tương đồng văn bản" in result.reason


def test_vietnamese_same_language_fixed_golden() -> None:
    cv_detection = detect_language(VIETNAMESE_CV)
    job_detection = detect_job_language(VIETNAMESE_JOB)
    cv_processed = preprocess_vietnamese(VIETNAMESE_CV).processed_text
    job_processed = preprocess_vietnamese_job(VIETNAMESE_JOB).processed_text
    response = recommend_english(
        _request(
            cv_text=VIETNAMESE_CV,
            cv_skills=["Java", "Spring Boot", "PostgreSQL"],
            jobs=[
                (
                    10,
                    VIETNAMESE_JOB,
                    ["Java", "Spring Boot", "PostgreSQL", "Docker"],
                ),
                (
                    9,
                    VIETNAMESE_JOB,
                    ["Java", "Spring Boot", "PostgreSQL", "Docker"],
                ),
            ],
        )
    )

    assert cv_detection.language_code.value == "vi"
    assert cv_detection.confidence == 1.0
    assert job_detection.language_code.value == "vi"
    assert job_detection.confidence == 1.0
    assert cv_processed == (
        "kỹ_sư_phần_mềm kinh_nghiệm phát_triển rest_api "
        "kiến_trúc_vi_dịch_vụ java spring_boot postgresql đã xây_dựng "
        "quy_trình ci/cd triển_khai ứng_dụng docker"
    )
    assert job_processed == (
        "lập_trình_viên backend phát_triển_phần_mềm rest_api người dùng "
        "kinh_nghiệm làm_việc kiến_trúc_vi_dịch_vụ cơ_sở_dữ_liệu"
    )

    # Locked raw cosine is 0.3973597071195133. The exact composite is
    # 0.65 * 0.3973597071195133 + 0.35 * 0.75 = 0.520783809627683645,
    # which projects HALF_UP to the fixed public score 0.52078381.
    assert [result.jobId for result in response.results] == [9, 10]
    assert [result.model_dump(mode="json") for result in response.results] == [
        {
            "jobId": job_id,
            "score": 0.52078381,
            "textScore": 0.39735971,
            "skillScore": 0.75,
            "scoringStrategy": "SAME_LANGUAGE_HYBRID",
            "matchedSkills": ["java", "postgresql", "spring boot"],
            "missingSkills": ["docker"],
            "reason": (
                "Đã khớp 3/4 kỹ năng: java, postgresql, spring boot. "
                "Còn thiếu 1 kỹ năng. Độ tương đồng văn bản cùng ngôn ngữ: "
                "39.735971%; độ bao phủ kỹ năng: 75%."
            ),
        }
        for job_id in (9, 10)
    ]


def test_vietnamese_cv_to_english_job_is_skill_only_with_alias_equivalence() -> None:
    result = recommend_english(
        _request(
            cv_text=VIETNAMESE_CV,
            cv_skills=[
                "Java",
                "Spring Boot",
                "PostgreSQL",
                "cơ sở dữ liệu",
            ],
            jobs=[
                (
                    20,
                    ENGLISH_JOB,
                    ["java", "spring boot", "postgresql", "docker"],
                )
            ],
        )
    ).results[0]

    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.skillScore == 0.75
    assert result.score == result.skillScore
    assert result.matchedSkills == ["java", "postgresql", "spring boot"]
    assert result.missingSkills == ["docker"]
    assert "Không sử dụng độ tương đồng văn bản" in result.reason


def test_english_cv_to_vietnamese_job_is_skill_only_with_english_reason() -> None:
    result = recommend_english(
        _request(
            cv_text=ENGLISH_CV,
            cv_skills=["Java", "Spring Boot"],
            jobs=[
                (
                    30,
                    VIETNAMESE_JOB,
                    ["Java", "Spring Boot", "Docker"],
                )
            ],
        )
    ).results[0]

    assert result.scoringStrategy is ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
    assert result.textScore is None
    assert result.score == result.skillScore == pytest.approx(2 / 3, abs=1e-8)
    assert "Text similarity was not used" in result.reason


def test_mixed_job_corpus_selects_each_strategy_independently() -> None:
    response = recommend_english(
        _request(
            cv_text=ENGLISH_CV,
            cv_skills=["Java"],
            jobs=[
                (40, ENGLISH_JOB, ["Java"]),
                (41, VIETNAMESE_JOB, ["Java"]),
                (42, MIXED_JOB, ["Java"]),
                (43, UNKNOWN_JOB, ["Java"]),
            ],
        )
    )
    results = _result_by_id(response)

    assert results[40].scoringStrategy is ScoringStrategy.SAME_LANGUAGE_HYBRID
    assert results[40].textScore is not None
    for job_id in (41, 42, 43):
        assert results[job_id].scoringStrategy is (
            ScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
        )
        assert results[job_id].textScore is None
        assert results[job_id].score == results[job_id].skillScore


@pytest.mark.parametrize(
    "extra_job",
    [
        (51, VIETNAMESE_JOB, ["Java"]),
        (52, MIXED_JOB, ["Java"]),
        (53, UNKNOWN_JOB, ["Java"]),
    ],
)
def test_cross_language_jobs_do_not_change_english_text_score(
    extra_job: tuple[int, str, list[str]],
) -> None:
    base_request = _request(
        cv_text=ENGLISH_CV,
        cv_skills=["Java"],
        jobs=[(50, ENGLISH_JOB, ["Java"])],
    )
    expanded_request = _request(
        cv_text=ENGLISH_CV,
        cv_skills=["Java"],
        jobs=[(50, ENGLISH_JOB, ["Java"]), extra_job],
    )

    baseline = _result_by_id(recommend_english(base_request))[50]
    expanded = _result_by_id(recommend_english(expanded_request))[50]

    assert expanded.textScore == baseline.textScore
    assert expanded.skillScore == baseline.skillScore
    assert expanded.score == baseline.score
    assert expanded.reason == baseline.reason


def test_english_cross_language_job_does_not_change_vietnamese_text_score() -> None:
    base = _request(
        cv_text=VIETNAMESE_CV,
        cv_skills=["Java"],
        jobs=[(60, VIETNAMESE_JOB, ["Java"])],
    )
    expanded = _request(
        cv_text=VIETNAMESE_CV,
        cv_skills=["Java"],
        jobs=[
            (60, VIETNAMESE_JOB, ["Java"]),
            (61, ENGLISH_JOB, ["Java"]),
        ],
    )

    original = _result_by_id(recommend_english(base))[60]
    with_cross_language = _result_by_id(recommend_english(expanded))[60]

    assert with_cross_language.textScore == original.textScore
    assert with_cross_language.score == original.score
    assert with_cross_language.reason == original.reason


def test_cross_language_no_skill_job_has_zero_scores_and_null_text() -> None:
    result = recommend_english(
        _request(
            cv_text=VIETNAMESE_CV,
            cv_skills=["Java"],
            jobs=[(70, ENGLISH_JOB, [])],
        )
    ).results[0]

    assert result.textScore is None
    assert result.skillScore == 0.0
    assert result.score == 0.0


def test_cross_language_threshold_uses_public_score_and_includes_equality() -> None:
    base = dict(
        cv_text=VIETNAMESE_CV,
        cv_skills=["Java"],
        jobs=[(80, ENGLISH_JOB, ["Java", "Docker", "Python"])],
    )

    equal = recommend_english(_request(**base, threshold=0.33333333))
    higher = recommend_english(_request(**base, threshold=0.33333334))

    assert equal.results[0].score == 0.33333333
    assert higher.results == []


def test_bilingual_response_contract_and_tie_sorting_are_stable() -> None:
    request = _request(
        cv_text=VIETNAMESE_CV,
        cv_skills=["Java"],
        jobs=[
            (92, ENGLISH_JOB, ["Java"]),
            (91, ENGLISH_JOB, ["Java"]),
        ],
        limit=1,
    )

    first = recommend_english(request)
    second = recommend_english(request)

    assert first.model_dump(mode="json") == second.model_dump(mode="json")
    assert first.requestId == UUID(REQUEST_ID)
    assert [result.jobId for result in first.results] == [91]
    assert set(first.model_dump()) == {
        "requestId",
        "algorithm",
        "algorithmVersion",
        "results",
    }
    assert set(first.results[0].model_dump()) == {
        "jobId",
        "score",
        "textScore",
        "skillScore",
        "scoringStrategy",
        "matchedSkills",
        "missingSkills",
        "reason",
    }
    assert "rank" not in first.model_dump_json()
    assert "rankPosition" not in first.model_dump_json()


def test_complete_skill_sets_drive_score_before_independent_caps() -> None:
    matched = [f"matched-{index:03d}" for index in range(130)]
    missing = [f"missing-{index:03d}" for index in range(120)]
    result = recommend_english(
        _request(
            cv_text=VIETNAMESE_CV,
            cv_skills=matched,
            jobs=[(100, ENGLISH_JOB, matched + missing)],
        )
    ).results[0]

    assert result.skillScore == pytest.approx(130 / 250, abs=1e-8)
    assert result.score == result.skillScore
    assert len(result.matchedSkills) == 100
    assert len(result.missingSkills) == 100
    assert result.matchedSkills == sorted(matched)[:100]
    assert result.missingSkills == sorted(missing)[:100]
