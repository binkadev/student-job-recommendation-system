"""Tests for deterministic same-language V2 reason generation."""

from decimal import Decimal

import pytest

from v2.reason_generator import generate_same_language_reason


def _generate(**overrides) -> str:
    arguments = {
        "text_score": Decimal("0.65000000"),
        "skill_score": Decimal("0.66666667"),
        "full_matched_skills": ("spring boot", "java"),
        "matched_count": 2,
        "missing_count": 1,
        "job_skill_count": 3,
    }
    arguments.update(overrides)
    return generate_same_language_reason(**arguments)


def test_matched_reason_uses_complete_counts_and_first_three_sorted_skills() -> None:
    matched_skills = (
        "spring boot",
        "java",
        "docker",
        "postgresql",
    )
    original = matched_skills

    reason = _generate(
        text_score=Decimal("0.12345678"),
        skill_score=Decimal("0.66666667"),
        full_matched_skills=matched_skills,
        matched_count=4,
        missing_count=2,
        job_skill_count=6,
    )

    assert reason == (
        "Matched 4 of 6 job skills: docker, java, postgresql. "
        "Missing job skills: 2. "
        "Same-language text similarity: 12.345678%. "
        "Canonical skill coverage: 66.666667%."
    )
    assert "spring boot" not in reason
    assert matched_skills == original
    assert _generate(
        text_score=Decimal("0.12345678"),
        skill_score=Decimal("0.66666667"),
        full_matched_skills=matched_skills,
        matched_count=4,
        missing_count=2,
        job_skill_count=6,
    ) == reason


def test_no_overlap_reason_uses_the_exact_public_text_score() -> None:
    assert _generate(
        text_score=Decimal("0.42000000"),
        skill_score=Decimal("0"),
        full_matched_skills=(),
        matched_count=0,
        missing_count=3,
        job_skill_count=3,
    ) == (
        "No canonical skill overlap. "
        "Matched 0 of 3 job skills; missing job skills: 3. "
        "Same-language text similarity: 42%. "
        "Canonical skill coverage: 0%."
    )


def test_job_without_skills_explicitly_uses_text_only_scoring() -> None:
    assert _generate(
        text_score=Decimal("0.65000000"),
        skill_score=Decimal("0"),
        full_matched_skills=(),
        matched_count=0,
        missing_count=0,
        job_skill_count=0,
    ) == (
        "No canonical job skills were provided, so scoring is text-only. "
        "Matched 0 of 0 job skills; missing job skills: 0. "
        "Same-language text similarity: 65%. "
        "Canonical skill coverage: 0%."
    )


@pytest.mark.parametrize(
    ("score", "rendered"),
    [
        (Decimal("0.00000000"), "0%"),
        (Decimal("-0.00000000"), "0%"),
        (Decimal("0.65000000"), "65%"),
        (Decimal("0.12345678"), "12.345678%"),
        (Decimal("1.00000000"), "100%"),
        (Decimal("1"), "100%"),
    ],
)
def test_percentage_formatting_is_exact_and_deterministic(
    score: Decimal,
    rendered: str,
) -> None:
    reason = _generate(text_score=score)

    assert (
        f"Same-language text similarity: {rendered}."
        in reason
    )


@pytest.mark.parametrize(
    ("score", "rendered"),
    [
        (Decimal("0.00000000"), "0%"),
        (Decimal("0.66666667"), "66.666667%"),
        (Decimal("0.87654321"), "87.654321%"),
        (Decimal("1"), "100%"),
    ],
)
def test_skill_score_formatting_is_exact_and_deterministic(
    score: Decimal,
    rendered: str,
) -> None:
    reason = _generate(skill_score=score)

    assert reason.endswith(f"Canonical skill coverage: {rendered}.")


def test_reason_uses_complete_counts_beyond_response_array_cap() -> None:
    matched_skills = tuple(
        f"skill-{index:03d}"
        for index in reversed(range(150))
    )

    reason = _generate(
        full_matched_skills=matched_skills,
        matched_count=150,
        missing_count=150,
        job_skill_count=300,
        skill_score=Decimal("0.50000000"),
    )

    assert reason.startswith(
        "Matched 150 of 300 job skills: "
        "skill-000, skill-001, skill-002."
    )
    assert "Missing job skills: 150." in reason
    assert reason.endswith("Canonical skill coverage: 50%.")
    assert "skill-149" not in reason


def test_reason_is_bounded_and_contains_no_forbidden_claims() -> None:
    reason = _generate(
        full_matched_skills=(
            "a" * 150,
            "b" * 150,
            "c" * 150,
        ),
        matched_count=3,
        missing_count=0,
        job_skill_count=3,
        skill_score=Decimal("1"),
    )

    assert len(reason) <= 2_000
    forbidden_claims = (
        "experience",
        "education",
        "company fit",
        "salary",
        "location",
        "seniority",
        "interview",
        "probability",
        "chance",
    )
    assert all(claim not in reason.casefold() for claim in forbidden_claims)


@pytest.mark.parametrize(
    ("field", "value", "error_type"),
    [
        ("text_score", 0.5, TypeError),
        ("text_score", Decimal("NaN"), ValueError),
        ("text_score", Decimal("-0.00000001"), ValueError),
        ("text_score", Decimal("1.00000001"), ValueError),
        ("skill_score", 0.5, TypeError),
        ("skill_score", Decimal("Infinity"), ValueError),
        ("matched_count", True, TypeError),
        ("matched_count", -1, ValueError),
        ("missing_count", False, TypeError),
        ("missing_count", -1, ValueError),
        ("job_skill_count", 1.0, TypeError),
        ("job_skill_count", -1, ValueError),
    ],
)
def test_rejects_invalid_scores_and_counts(
    field: str,
    value: object,
    error_type: type[Exception],
) -> None:
    with pytest.raises(error_type):
        _generate(**{field: value})


def test_rejects_inconsistent_complete_counts() -> None:
    with pytest.raises(ValueError, match="complete matched skill count"):
        _generate(matched_count=3)

    with pytest.raises(ValueError, match="must equal job_skill_count"):
        _generate(missing_count=2)

    with pytest.raises(ValueError, match="must not contain duplicates"):
        _generate(
            full_matched_skills=("java", "java"),
            matched_count=2,
        )

    with pytest.raises(ValueError, match="must be zero"):
        _generate(
            full_matched_skills=(),
            matched_count=0,
            missing_count=0,
            job_skill_count=0,
            skill_score=Decimal("0.1"),
        )


@pytest.mark.parametrize(
    "skills",
    [
        ["java", "spring boot"],
        ("java", None),
        ("java", ""),
        ("java", " " * 2),
        ("java", "x" * 151),
    ],
)
def test_rejects_invalid_complete_matched_skill_values(skills) -> None:
    with pytest.raises((TypeError, ValueError)):
        _generate(full_matched_skills=skills)
