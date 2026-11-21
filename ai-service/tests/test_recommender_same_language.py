"""Tests for deterministic English Global-IDF recommendation scoring."""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from decimal import Decimal, ROUND_DOWN, localcontext

import pytest

import scoring.job_recommender as recommender_module
from scoring.job_recommender import (
    PreparedJob,
    ScoredJob,
    score_cross_language_recommendations,
    score_same_language_recommendations,
)
from scoring.math_utils import project_public_score
from scoring.tfidf_artifact import TfidfModelArtifact


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


def test_scoring_uses_transform_only_and_never_calls_fit(
    monkeypatch,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    def forbid_fit(*_args, **_kwargs):
        raise AssertionError("Online scoring must NEVER call .fit() or .fit_transform()")

    monkeypatch.setattr(tfidf_artifact.vectorizer, "fit", forbid_fit)
    monkeypatch.setattr(tfidf_artifact.vectorizer, "fit_transform", forbid_fit)

    results = score_same_language_recommendations(
        cv_processed_text="software_engineer java spring_boot postgresql docker rest_api",
        cv_canonical_skills=frozenset({"java", "spring boot", "postgresql", "docker"}),
        jobs=(
            _job(
                1,
                "backend_developer java spring_boot postgresql docker rest_api",
                frozenset({"java", "spring boot", "postgresql", "docker"}),
            ),
            _job(
                2,
                "frontend_developer react typescript html css",
                frozenset({"react", "typescript"}),
            ),
        ),
        threshold=Decimal("0"),
        limit=10,
        tfidf_artifact=tfidf_artifact,
    )

    assert [item.job_id for item in results] == [1, 2]
    assert results[0].text_score is not None and results[0].text_score > Decimal("0")
    assert results[0].skill_score == Decimal("1.00000000")
    assert results[0].score > results[1].score


def test_global_idf_score_is_invariant_to_other_jobs_in_request(
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    """Adding unrelated jobs to a request must not change a job's Global-IDF textScore."""

    target_job = _job(
        10,
        "backend_developer java spring_boot postgresql docker rest_api",
        frozenset({"java", "spring boot"}),
    )
    unrelated_job = _job(
        20,
        "frontend_developer react angular vue svelte css html",
        frozenset({"react"}),
    )
    cv_text = "software_engineer java spring_boot postgresql docker"
    cv_skills = frozenset({"java", "spring boot"})

    solo = score_same_language_recommendations(
        cv_processed_text=cv_text,
        cv_canonical_skills=cv_skills,
        jobs=(target_job,),
        threshold=Decimal("0"),
        limit=10,
        tfidf_artifact=tfidf_artifact,
    )[0]
    batched = [
        item
        for item in score_same_language_recommendations(
            cv_processed_text=cv_text,
            cv_canonical_skills=cv_skills,
            jobs=(target_job, unrelated_job),
            threshold=Decimal("0"),
            limit=10,
            tfidf_artifact=tfidf_artifact,
        )
        if item.job_id == 10
    ][0]

    assert solo.text_score == batched.text_score
    assert solo.score == batched.score


def test_hybrid_formula_uses_unrounded_component_values_and_round_half_up(
    monkeypatch,
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    monkeypatch.setattr(
        recommender_module,
        "_calculate_text_scores",
        lambda _cv, _jobs, *, tfidf_artifact: (0.4,),
    )

    with localcontext() as ctx:
        ctx.rounding = ROUND_DOWN
        result = score_same_language_recommendations(
            cv_processed_text="java",
            cv_canonical_skills=frozenset({"java"}),
            jobs=(_job(1, "java", frozenset({"java", "docker", "git"})),),
            threshold=Decimal("0"),
            limit=10,
            tfidf_artifact=tfidf_artifact,
        )[0]

    # 0.65 * 0.4 + 0.35 * (1/3) = 0.26 + 0.116666666... = 0.37666667
    assert result.text_score == Decimal("0.40000000")
    assert result.skill_score == Decimal("0.33333333")
    assert result.score == Decimal("0.37666667")
    assert result.full_matched_skills == ("java",)
    assert result.full_missing_skills == ("docker", "git")


def test_oov_and_empty_text_return_zero_text_score_safely(
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    results = score_same_language_recommendations(
        cv_processed_text="completely_unseen_oov_xyz_token",
        cv_canonical_skills=frozenset({"java"}),
        jobs=(
            _job(1, "another_unseen_oov_abc_token", frozenset({"java"})),
            _job(2, "", frozenset()),
        ),
        threshold=Decimal("0"),
        limit=10,
        tfidf_artifact=tfidf_artifact,
    )

    by_id = {item.job_id: item for item in results}
    assert by_id[1].text_score == Decimal("0.00000000")
    assert by_id[1].skill_score == Decimal("1.00000000")
    assert by_id[1].score == Decimal("0.35000000")
    assert by_id[2].text_score == Decimal("0.00000000")
    assert by_id[2].score == Decimal("0.00000000")


def test_deterministic_tie_breaking_threshold_and_immutability(
    tfidf_artifact: TfidfModelArtifact,
) -> None:
    jobs = (
        _job(30, "java spring_boot", frozenset({"java"})),
        _job(10, "java spring_boot", frozenset({"java"})),
        _job(20, "java spring_boot", frozenset({"java"})),
    )
    results = score_same_language_recommendations(
        cv_processed_text="java spring_boot",
        cv_canonical_skills=frozenset({"java"}),
        jobs=jobs,
        threshold=Decimal("0"),
        limit=2,
        tfidf_artifact=tfidf_artifact,
    )

    assert [item.job_id for item in results] == [10, 20]
    with pytest.raises(FrozenInstanceError):
        results[0].score = Decimal("0")  # type: ignore[misc]


def test_cross_language_fallback_uses_skill_score_only() -> None:
    results = score_cross_language_recommendations(
        cv_canonical_skills=frozenset({"java", "docker"}),
        jobs=(
            _job(2, "", frozenset({"java", "docker"})),
            _job(1, "", frozenset({"java", "docker", "kubernetes"})),
        ),
        threshold=Decimal("0"),
        limit=10,
    )
    assert [item.job_id for item in results] == [2, 1]
    assert all(item.text_score is None for item in results)
    assert results[0].score == Decimal("1.00000000")
    assert results[1].score == Decimal("0.66666667")


def test_project_public_score_clamps_and_validates() -> None:
    assert project_public_score(-0.01) == Decimal("0.00000000")
    assert project_public_score(1.01) == Decimal("1.00000000")
    with pytest.raises(ValueError):
        project_public_score(float("nan"))
    with pytest.raises(TypeError):
        project_public_score(True)  # type: ignore[arg-type]
