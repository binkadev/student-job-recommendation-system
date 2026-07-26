"""Tests for deterministic English same-language recommendation scoring."""

from dataclasses import FrozenInstanceError
from decimal import Decimal, ROUND_DOWN, localcontext
import math

import numpy as np
import pytest

import v2.recommender as recommender_module
from v2.recommender import (
    PreparedJob,
    ScoredRecommendation,
    project_public_score,
    score_same_language_recommendations,
)


def _job(
    job_id: int,
    processed_text: str,
    skills: frozenset[str] = frozenset(),
) -> PreparedJob:
    return PreparedJob(
        job_id=job_id,
        processed_text=processed_text,
        canonical_skills=skills,
    )


def _score(
    *,
    cv_text: str = "java backend",
    cv_skills: frozenset[str] = frozenset(),
    jobs: tuple[PreparedJob, ...],
    threshold: Decimal = Decimal("0"),
    limit: int = 100,
) -> tuple[ScoredRecommendation, ...]:
    return score_same_language_recommendations(
        cv_processed_text=cv_text,
        cv_canonical_skills=cv_skills,
        jobs=jobs,
        threshold=threshold,
        limit=limit,
    )


def test_vectorizer_configuration_and_job_only_fit_order(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class SpyVectorizer:
        def __init__(self, **kwargs) -> None:
            captured["configuration"] = kwargs

        def fit_transform(self, documents):
            captured["fit_documents"] = list(documents)
            return np.array([[1.0, 0.0], [0.0, 1.0]])

        def transform(self, documents):
            captured["transform_documents"] = list(documents)
            return np.array([[1.0, 0.0]])

    monkeypatch.setattr(
        recommender_module,
        "TfidfVectorizer",
        SpyVectorizer,
    )

    results = _score(
        cv_text="cv query only",
        jobs=(
            _job(1, "first job"),
            _job(2, "second job"),
        ),
    )

    assert captured["configuration"] == {
        "analyzer": "word",
        "tokenizer": str.split,
        "token_pattern": None,
        "lowercase": False,
        "ngram_range": (1, 2),
        "sublinear_tf": True,
        "stop_words": None,
    }
    assert captured["fit_documents"] == ["first job", "second job"]
    assert captured["transform_documents"] == ["cv query only"]
    assert [result.text_score for result in results] == [
        Decimal("1.00000000"),
        Decimal("0E-8"),
    ]


def test_cv_only_terms_do_not_enter_the_job_vocabulary() -> None:
    results = _score(
        cv_text="shared cv-only-term",
        jobs=(
            _job(1, "shared"),
            _job(2, "job-only-term"),
        ),
    )

    assert results[0].job_id == 1
    assert results[0].text_score == Decimal("1.00000000")
    assert results[1].job_id == 2
    assert results[1].text_score == Decimal("0E-8")


def test_hybrid_formula_uses_unrounded_component_values(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.4,),
    )

    result = _score(
        cv_skills=frozenset({"java"}),
        jobs=(
            _job(
                1,
                "ignored",
                frozenset({"java", "python"}),
            ),
        ),
    )[0]

    assert result.text_score == Decimal("0.40000000")
    assert result.skill_score == Decimal("0.50000000")
    assert result.score == Decimal("0.43500000")


def test_hybrid_formula_does_not_combine_rounded_public_components(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.123456785,),
    )

    result = _score(
        cv_skills=frozenset({"java", "python"}),
        jobs=(
            _job(
                1,
                "ignored",
                frozenset({"java", "python", "go"}),
            ),
        ),
    )[0]

    assert result.text_score == Decimal("0.12345679")
    assert result.skill_score == Decimal("0.66666667")
    assert result.score == Decimal("0.31358024")


def test_job_without_skills_falls_back_to_text_score(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.412345678,),
    )

    result = _score(jobs=(_job(1, "ignored"),))[0]

    assert result.skill_score == Decimal("0E-8")
    assert result.text_score == Decimal("0.41234568")
    assert result.score == result.text_score


def test_empty_vocabulary_keeps_skill_scoring() -> None:
    result = _score(
        cv_text="",
        cv_skills=frozenset({"java"}),
        jobs=(_job(1, "", frozenset({"java"})),),
        threshold=Decimal("0.35"),
    )[0]

    assert result.text_score == Decimal("0E-8")
    assert result.skill_score == Decimal("1.00000000")
    assert result.score == Decimal("0.35000000")


def test_blank_job_alongside_valid_job_receives_zero_text_score() -> None:
    results = _score(
        cv_text="java",
        cv_skills=frozenset({"java"}),
        jobs=(
            _job(20, "", frozenset({"java"})),
            _job(10, "java"),
        ),
    )
    by_job_id = {result.job_id: result for result in results}

    assert by_job_id[20].text_score == Decimal("0E-8")
    assert by_job_id[20].score == Decimal("0.35000000")
    assert by_job_id[10].text_score == Decimal("1.00000000")
    assert by_job_id[10].score == Decimal("1.00000000")


def test_zero_vector_cv_keeps_skill_scoring() -> None:
    result = _score(
        cv_text="",
        cv_skills=frozenset({"java"}),
        jobs=(_job(1, "java", frozenset({"java"})),),
    )[0]

    assert result.text_score == Decimal("0E-8")
    assert result.skill_score == Decimal("1.00000000")
    assert result.score == Decimal("0.35000000")


def test_complete_skill_sets_are_sorted_and_never_response_capped() -> None:
    matched = frozenset(f"matched-{index:03d}" for index in range(150))
    missing = frozenset(f"missing-{index:03d}" for index in range(125))
    result = _score(
        cv_text="",
        cv_skills=matched,
        jobs=(_job(1, "", matched | missing),),
    )[0]

    assert len(result.full_matched_skills) == 150
    assert len(result.full_missing_skills) == 125
    assert result.full_matched_skills == tuple(sorted(matched))
    assert result.full_missing_skills == tuple(sorted(missing))
    assert result.skill_score == Decimal("0.54545455")
    assert result.score == Decimal("0.19090909")
    assert result.reason.startswith("Matched 150 of 275 job skills:")
    assert "matched-000, matched-001, matched-002" in result.reason


def test_reason_receives_public_scores_and_complete_counts(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_reason(**kwargs) -> str:
        captured.update(kwargs)
        return "deterministic reason"

    monkeypatch.setattr(
        recommender_module,
        "generate_same_language_reason",
        fake_reason,
    )
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.2,),
    )

    result = _score(
        cv_skills=frozenset({"beta", "alpha"}),
        jobs=(
            _job(
                1,
                "ignored",
                frozenset({"gamma", "alpha", "beta"}),
            ),
        ),
    )[0]

    assert captured == {
        "text_score": Decimal("0.20000000"),
        "skill_score": Decimal("0.66666667"),
        "full_matched_skills": ("alpha", "beta"),
        "matched_count": 2,
        "missing_count": 1,
        "job_skill_count": 3,
    }
    assert result.reason == "deterministic reason"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (Decimal("0.123456784"), Decimal("0.12345678")),
        (Decimal("0.123456785"), Decimal("0.12345679")),
        (Decimal("-0"), Decimal("0E-8")),
        (-0.0, Decimal("0E-8")),
        (-0.00000001, Decimal("0E-8")),
        (1.00000001, Decimal("1.00000000")),
        (0, Decimal("0E-8")),
        (1, Decimal("1.00000000")),
    ],
)
def test_public_score_projection_rounds_half_up_and_clamps(
    value,
    expected: Decimal,
) -> None:
    projected = project_public_score(value)

    assert projected == expected
    assert projected.as_tuple().exponent == -8
    assert not projected.is_signed() or projected != 0


@pytest.mark.parametrize(
    "value",
    [
        float("nan"),
        float("inf"),
        float("-inf"),
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
    ],
)
def test_public_score_projection_rejects_nonfinite_values(value) -> None:
    with pytest.raises(ValueError, match="finite"):
        project_public_score(value)


@pytest.mark.parametrize("value", [True, False, "0.5", object()])
def test_public_score_projection_rejects_non_numeric_values(value) -> None:
    with pytest.raises(TypeError, match="must be"):
        project_public_score(value)


def test_nonfinite_cosine_similarity_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (math.nan,),
    )

    with pytest.raises(ValueError, match="must be finite"):
        _score(jobs=(_job(1, "ignored"),))


def test_filtering_uses_the_exact_returned_rounded_score(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.099999995, 0.099999994),
    )

    results = _score(
        jobs=(
            _job(1, "first"),
            _job(2, "second"),
        ),
        threshold=Decimal("0.1"),
    )

    assert [(result.job_id, result.score) for result in results] == [
        (1, Decimal("0.10000000"))
    ]


def test_threshold_equality_is_included_and_immediately_higher_is_excluded(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.099999995,),
    )
    jobs = (_job(1, "only job"),)

    equal = _score(jobs=jobs, threshold=Decimal("0.10000000"))
    immediately_higher = _score(
        jobs=jobs,
        threshold=Decimal("0.10000001"),
    )

    assert [result.score for result in equal] == [Decimal("0.10000000")]
    assert immediately_higher == ()


def test_threshold_one_includes_only_a_public_score_of_one(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (1.0, 0.99999999),
    )

    results = _score(
        jobs=(
            _job(1, "exact"),
            _job(2, "below"),
        ),
        threshold=Decimal("1"),
    )

    assert [(result.job_id, result.score) for result in results] == [
        (1, Decimal("1.00000000"))
    ]


def test_equal_returned_scores_tie_break_by_job_id(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.500000004, 0.500000003),
    )

    results = _score(
        jobs=(
            _job(20, "first"),
            _job(10, "second"),
        ),
    )

    assert [result.job_id for result in results] == [10, 20]
    assert all(result.score == Decimal("0.50000000") for result in results)


def test_limit_is_applied_after_filtering_and_sorting(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.2, 0.9, 0.8),
    )

    results = _score(
        jobs=(
            _job(1, "low"),
            _job(2, "highest"),
            _job(3, "second"),
        ),
        threshold=Decimal("0.5"),
        limit=1,
    )

    assert [result.job_id for result in results] == [2]


def test_filtered_candidates_do_not_generate_reasons(monkeypatch) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.1,),
    )

    def fail_reason(**_kwargs):
        raise AssertionError("reason must not run for filtered candidates")

    monkeypatch.setattr(
        recommender_module,
        "generate_same_language_reason",
        fail_reason,
    )

    assert _score(
        jobs=(_job(1, "filtered"),),
        threshold=Decimal("0.2"),
    ) == ()


def test_only_empty_vocabulary_value_error_is_handled(monkeypatch) -> None:
    class BrokenVectorizer:
        def __init__(self, **_kwargs) -> None:
            pass

        def fit_transform(self, _documents):
            raise ValueError("invalid vectorizer configuration")

    monkeypatch.setattr(
        recommender_module,
        "TfidfVectorizer",
        BrokenVectorizer,
    )

    with pytest.raises(ValueError, match="invalid vectorizer configuration"):
        _score(jobs=(_job(1, "ignored"),))


def test_empty_jobs_return_without_constructing_tfidf(monkeypatch) -> None:
    def fail_text_scores(_cv, _jobs):
        raise AssertionError("TF-IDF must not run for an empty Job tuple")

    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        fail_text_scores,
    )

    assert _score(jobs=()) == ()


@pytest.mark.parametrize(
    "threshold",
    [
        Decimal("-0.00000001"),
        Decimal("1.00000001"),
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
    ],
)
def test_invalid_thresholds_are_rejected(threshold: Decimal) -> None:
    with pytest.raises(ValueError, match="Threshold"):
        _score(jobs=(), threshold=threshold)


def test_threshold_must_be_decimal() -> None:
    with pytest.raises(TypeError, match="Threshold"):
        score_same_language_recommendations(
            cv_processed_text="",
            cv_canonical_skills=frozenset(),
            jobs=(),
            threshold=0.1,  # type: ignore[arg-type]
            limit=20,
        )


@pytest.mark.parametrize("limit", [0, 101, -1])
def test_out_of_range_limits_are_rejected(limit: int) -> None:
    with pytest.raises(ValueError, match="Limit"):
        _score(jobs=(), limit=limit)


@pytest.mark.parametrize("limit", [True, False, 1.0, "1"])
def test_limit_must_be_a_non_boolean_integer(limit) -> None:
    with pytest.raises(TypeError, match="Limit"):
        _score(jobs=(), limit=limit)


def test_internal_score_records_are_immutable() -> None:
    prepared_job = _job(1, "java")
    with pytest.raises(FrozenInstanceError):
        prepared_job.job_id = 2  # type: ignore[misc]

    result = _score(jobs=(prepared_job,))[0]
    with pytest.raises(FrozenInstanceError):
        result.score = Decimal("0")  # type: ignore[misc]


def test_scoring_is_independent_of_the_callers_decimal_context(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs: (0.123456785,),
    )

    with localcontext() as caller_context:
        caller_context.prec = 4
        caller_context.rounding = ROUND_DOWN
        projected = project_public_score(Decimal("0.123456785"))
        result = _score(
            cv_skills=frozenset({"java", "python"}),
            jobs=(
                _job(
                    1,
                    "ignored",
                    frozenset({"java", "python", "go"}),
                ),
            ),
        )[0]

    assert projected == Decimal("0.12345679")
    assert result.text_score == Decimal("0.12345679")
    assert result.skill_score == Decimal("0.66666667")
    assert result.score == Decimal("0.31358024")
    assert "12.345679%" in result.reason
    assert "66.666667%" in result.reason


@pytest.mark.parametrize(
    ("field_name", "value", "expected_exception"),
    [
        ("cv_processed_text", None, TypeError),
        ("cv_canonical_skills", set(), TypeError),
        ("jobs", [], TypeError),
    ],
)
def test_scoring_inputs_use_the_locked_internal_types(
    field_name,
    value,
    expected_exception,
) -> None:
    kwargs = {
        "cv_processed_text": "",
        "cv_canonical_skills": frozenset(),
        "jobs": (),
        "threshold": Decimal("0"),
        "limit": 20,
    }
    kwargs[field_name] = value

    with pytest.raises(expected_exception):
        score_same_language_recommendations(**kwargs)
