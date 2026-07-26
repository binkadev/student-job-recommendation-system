"""Deterministic same-language reason generation for AI service V2."""

from decimal import Context, Decimal, localcontext

from .constants import PUBLIC_SCORE_ROUNDING


_MAX_REASON_LENGTH = 2_000
_MAX_SKILL_LENGTH = 150
# Keep percentage rendering independent of the caller's Decimal context.
_REASON_DECIMAL_CONTEXT = Context(
    prec=50,
    rounding=PUBLIC_SCORE_ROUNDING,
)


def _validate_score(name: str, value: Decimal) -> None:
    if not isinstance(value, Decimal):
        raise TypeError(f"{name} must be a Decimal")
    if not value.is_finite() or value < 0 or value > 1:
        raise ValueError(f"{name} must be finite and between 0 and 1")


def _validate_count(name: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer")
    if value < 0:
        raise ValueError(f"{name} must not be negative")


def _format_percentage(score: Decimal) -> str:
    if score.is_zero():
        return "0"
    with localcontext(_REASON_DECIMAL_CONTEXT):
        rendered = format(score * Decimal("100"), "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    return rendered


def _validate_matched_skills(
    full_matched_skills: tuple[str, ...],
    matched_count: int,
) -> None:
    if not isinstance(full_matched_skills, tuple):
        raise TypeError("full_matched_skills must be a tuple")
    if len(full_matched_skills) != matched_count:
        raise ValueError(
            "matched_count must equal the complete matched skill count"
        )

    seen: set[str] = set()
    for skill in full_matched_skills:
        if not isinstance(skill, str):
            raise TypeError("matched skills must be strings")
        if not skill or skill.isspace():
            raise ValueError("matched skills must not be blank")
        if len(skill) > _MAX_SKILL_LENGTH:
            raise ValueError(
                f"matched skills must contain at most {_MAX_SKILL_LENGTH} "
                "characters"
            )
        if skill in seen:
            raise ValueError("full_matched_skills must not contain duplicates")
        seen.add(skill)


def generate_same_language_reason(
    *,
    text_score: Decimal,
    skill_score: Decimal,
    full_matched_skills: tuple[str, ...],
    matched_count: int,
    missing_count: int,
    job_skill_count: int,
) -> str:
    """Build one bounded reason from complete same-language scoring evidence."""

    _validate_score("text_score", text_score)
    _validate_score("skill_score", skill_score)
    _validate_count("matched_count", matched_count)
    _validate_count("missing_count", missing_count)
    _validate_count("job_skill_count", job_skill_count)
    _validate_matched_skills(full_matched_skills, matched_count)

    if matched_count + missing_count != job_skill_count:
        raise ValueError(
            "matched_count plus missing_count must equal job_skill_count"
        )
    if job_skill_count == 0 and skill_score != 0:
        raise ValueError("skill_score must be zero when the Job has no skills")

    text_percentage = _format_percentage(text_score)
    if job_skill_count == 0:
        reason = (
            "No canonical job skills were provided, so scoring is text-only. "
            "Matched 0 of 0 job skills; missing job skills: 0. "
            f"Same-language text similarity: {text_percentage}%. "
            "Canonical skill coverage: 0%."
        )
    elif matched_count == 0:
        reason = (
            "No canonical skill overlap. "
            f"Matched 0 of {job_skill_count} job skills; "
            f"missing job skills: {missing_count}. "
            f"Same-language text similarity: {text_percentage}%. "
            f"Canonical skill coverage: {_format_percentage(skill_score)}%."
        )
    else:
        displayed_skills = ", ".join(sorted(full_matched_skills)[:3])
        reason = (
            f"Matched {matched_count} of {job_skill_count} job skills: "
            f"{displayed_skills}. Missing job skills: {missing_count}. "
            f"Same-language text similarity: {text_percentage}%. "
            f"Canonical skill coverage: {_format_percentage(skill_score)}%."
        )

    if len(reason) > _MAX_REASON_LENGTH:
        raise ValueError(
            f"generated reason must contain at most {_MAX_REASON_LENGTH} "
            "characters"
        )
    return reason
