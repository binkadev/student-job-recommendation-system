"""Constant-time internal API key verification dependency."""

from __future__ import annotations

from collections.abc import Callable
import hmac

from fastapi import Request

from .errors import unauthorized_error


INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"


def make_internal_api_key_dependency(
    expected_api_key: str,
) -> Callable[[Request], None]:
    """Build a FastAPI dependency validating X-Internal-Api-Key safely."""

    expected_bytes = expected_api_key.encode("utf-8")

    def require_internal_api_key(request: Request) -> None:
        provided_key = request.headers.get(INTERNAL_API_KEY_HEADER)
        if provided_key is None or not hmac.compare_digest(
            provided_key.encode("utf-8"),
            expected_bytes,
        ):
            raise unauthorized_error()

    return require_internal_api_key
