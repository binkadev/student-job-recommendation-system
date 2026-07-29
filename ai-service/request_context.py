"""Safe request ID context and completion logging for the AI Service."""

from __future__ import annotations

from contextvars import ContextVar
import logging
import re
import time
from uuid import uuid4

from fastapi import FastAPI, Request, Response


REQUEST_ID_HEADER = "X-Request-Id"
REQUEST_ID_CONTEXT_KEY = "requestId"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$", re.ASCII)
_REQUEST_ID_CONTEXT: ContextVar[str | None] = ContextVar(
    REQUEST_ID_CONTEXT_KEY,
    default=None,
)
_LOGGER = logging.getLogger("ai_service.request")
_LOGGER.setLevel(logging.INFO)

# Uvicorn configures its handlers before importing main:app in production.
# Reuse those handlers so this dedicated application logger is visible in
# container logs. During unit tests there are normally no Uvicorn handlers,
# so propagation remains enabled for pytest caplog.
_uvicorn_handlers = tuple(logging.getLogger("uvicorn.error").handlers)
if not _LOGGER.handlers and _uvicorn_handlers:
    _LOGGER.handlers.extend(_uvicorn_handlers)
    _LOGGER.propagate = False
else:
    _LOGGER.propagate = True


def resolve_request_id(candidate: str | None) -> str:
    """Return a valid supplied ID or a new lowercase canonical UUID."""

    if candidate is not None:
        trimmed = candidate.strip()
        if candidate == trimmed and _VALID_REQUEST_ID.fullmatch(trimmed):
            return trimmed
    return str(uuid4())


def get_request_id() -> str | None:
    """Return the current request ID without creating ambient state."""

    return _REQUEST_ID_CONTEXT.get()


def install_request_context_middleware(app: FastAPI) -> None:
    """Install request tracing over every route registered on the app."""

    @app.middleware("http")
    async def request_context_middleware(
        request: Request,
        call_next,
    ) -> Response:
        request_id = resolve_request_id(
            request.headers.get(REQUEST_ID_HEADER)
        )
        token = _REQUEST_ID_CONTEXT.set(request_id)
        started_at = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            duration_ms = (time.perf_counter() - started_at) * 1000
            _LOGGER.info(
                "request completed requestId=%s method=%s path=%s "
                "status=%s durationMs=%.3f",
                request_id,
                request.method,
                request.url.path,
                status_code,
                duration_ms,
            )
            _REQUEST_ID_CONTEXT.reset(token)
