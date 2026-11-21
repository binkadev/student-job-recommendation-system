"""Shared Decimal arithmetic and eight-decimal ROUND_HALF_UP score projection."""

from decimal import Context, Decimal, localcontext

from core.constants import PUBLIC_SCORE_QUANTUM, PUBLIC_SCORE_ROUNDING


TEXT_WEIGHT = Decimal("0.65")
SKILL_WEIGHT = Decimal("0.35")
ZERO = Decimal("0")
ONE = Decimal("1")

# Never inherit a caller thread's mutable Decimal precision or rounding mode.
SCORING_DECIMAL_CONTEXT = Context(
    prec=50,
    rounding=PUBLIC_SCORE_ROUNDING,
)


def project_public_score(value: Decimal | float | int) -> Decimal:
    """Clamp and project a finite numeric score once to eight decimals."""

    if isinstance(value, bool) or not isinstance(value, (Decimal, float, int)):
        raise TypeError("Public score must be a Decimal, float, or integer")

    projected = Decimal(str(value))
    if not projected.is_finite():
        raise ValueError("Public score must be finite")

    if projected <= ZERO:
        projected = ZERO
    elif projected >= ONE:
        projected = ONE

    with localcontext(SCORING_DECIMAL_CONTEXT):
        return projected.quantize(
            PUBLIC_SCORE_QUANTUM,
            rounding=PUBLIC_SCORE_ROUNDING,
        )


__all__ = [
    "ONE",
    "SCORING_DECIMAL_CONTEXT",
    "SKILL_WEIGHT",
    "TEXT_WEIGHT",
    "ZERO",
    "project_public_score",
]
