"""HTTP client wrapper with retry classification for Backend Auth and CV APIs."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
import json
from pathlib import Path
import random
import time
from typing import Any

import httpx

_TRANSIENT_HTTP_STATUSES = frozenset({408, 429, 500, 502, 503, 504})
_REANALYZE_TRANSIENT_HTTP_STATUSES = frozenset({408, 429, 503, 504})


class IngestApiError(Exception):
    """Structured error captured from Backend HTTP calls."""

    def __init__(
        self,
        *,
        http_status: int | None,
        error_code: str,
        message: str,
        retryable: bool,
    ) -> None:
        self.http_status = http_status
        self.error_code = error_code
        self.message = message
        self.retryable = retryable
        super().__init__(f"[{error_code} HTTP {http_status}] {message}")


class EmailAlreadyExistsError(Exception):
    """Raised when /api/auth/register returns 409 EMAIL_ALREADY_EXISTS."""


class UnauthorizedSessionError(Exception):
    """Raised when an existing JWT receives 401 UNAUTHORIZED."""


@dataclass(frozen=True, slots=True)
class ExistingCvRecord:
    """Minimal projection of GET /api/students/me/cv items."""

    cv_id: int
    original_file_name: str
    file_size: int | None
    is_active: bool


@dataclass(frozen=True, slots=True)
class CvAnalysisResult:
    """Projection of GET /analysis and POST /reanalyze responses."""

    cv_id: int
    status: str
    processing_version: str | None
    language_code: str | None
    language_confidence: float | None
    extracted_skill_count: int
    analysis_error: str | None


def _parse_cv_analysis_payload(data: Any, *, fallback_cv_id: int) -> CvAnalysisResult:
    if not isinstance(data, dict):
        raise IngestApiError(
            http_status=200,
            error_code="INVALID_ANALYSIS_PAYLOAD",
            message="CV analysis response missing data object",
            retryable=False,
        )
    raw_conf = data.get("languageConfidence")
    skills = data.get("skills")
    skill_count = len(skills) if isinstance(skills, list) else 0
    return CvAnalysisResult(
        cv_id=int(data.get("cvId") if data.get("cvId") is not None else fallback_cv_id),
        status=str(data.get("status") or ""),
        processing_version=(
            None if data.get("processingVersion") is None else str(data["processingVersion"])
        ),
        language_code=(
            None if data.get("languageCode") is None else str(data["languageCode"])
        ),
        language_confidence=(None if raw_conf is None else float(raw_conf)),
        extracted_skill_count=skill_count,
        analysis_error=(
            None if data.get("analysisError") is None else str(data["analysisError"])
        ),
    )


def _parse_api_envelope(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _extract_error_fields(response: httpx.Response) -> tuple[str, str]:
    payload = _parse_api_envelope(response)
    error_code = payload.get("errorCode")
    message = payload.get("message")
    if not isinstance(error_code, str) or not error_code:
        error_code = f"HTTP_{response.status_code}"
    if not isinstance(message, str) or not message:
        message = response.text[:300] or f"HTTP status {response.status_code}"
    return error_code, message


class BackendIngestClient:
    """Thread-safe persistent httpx client talking strictly to Backend REST APIs."""

    def __init__(
        self,
        base_url: str,
        *,
        concurrency: int = 6,
        timeout_seconds: float = 30.0,
        max_retries: int = 4,
        transport: httpx.BaseTransport | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.max_retries = max(0, max_retries)
        self._sleep = sleep_fn
        limits = httpx.Limits(
            max_connections=max(concurrency + 4, 10),
            max_keepalive_connections=max(concurrency + 2, 8),
        )
        timeout = httpx.Timeout(timeout_seconds, connect=5.0)
        self._client = httpx.Client(
            base_url=self.base_url,
            limits=limits,
            timeout=timeout,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> BackendIngestClient:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def check_health(self) -> None:
        """Verify Backend reachability via public statistics endpoint."""
        try:
            response = self._request_with_retry("GET", "/api/public/statistics")
        except IngestApiError as exc:
            raise RuntimeError(
                f"Backend preflight health check failed at {self.base_url}: {exc}"
            ) from exc
        if response.status_code != 200:
            raise RuntimeError(
                f"Backend health check returned HTTP {response.status_code}"
            )

    def register_student(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
    ) -> int | None:
        """Register one STUDENT account (omitting phone). Returns userId or None on 409."""
        body = {
            "email": email,
            "password": password,
            "role": "STUDENT",
            "fullName": full_name,
        }
        response = self._request_with_retry(
            "POST",
            "/api/auth/register",
            json=body,
        )
        if response.status_code == 201:
            envelope = _parse_api_envelope(response)
            data = envelope.get("data") or {}
            user_id = data.get("id")
            return None if user_id is None else int(user_id)

        if response.status_code == 409:
            error_code, message = _extract_error_fields(response)
            if error_code == "EMAIL_ALREADY_EXISTS":
                raise EmailAlreadyExistsError()
            raise IngestApiError(
                http_status=409,
                error_code=error_code,
                message=message,
                retryable=False,
            )

        error_code, message = _extract_error_fields(response)
        raise IngestApiError(
            http_status=response.status_code,
            error_code=error_code,
            message=message,
            retryable=False,
        )

    def login(self, *, email: str, password: str) -> tuple[str, int | None]:
        """Authenticate and return (jwt_token, user_id)."""
        response = self._request_with_retry(
            "POST",
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        if response.status_code != 200:
            error_code, message = _extract_error_fields(response)
            raise IngestApiError(
                http_status=response.status_code,
                error_code=error_code,
                message=message,
                retryable=False,
            )

        envelope = _parse_api_envelope(response)
        data = envelope.get("data")
        if not isinstance(data, dict) or not isinstance(data.get("token"), str):
            raise IngestApiError(
                http_status=200,
                error_code="INVALID_LOGIN_PAYLOAD",
                message="Backend login response did not contain token",
                retryable=False,
            )
        user = data.get("user") or {}
        raw_id = user.get("id") if isinstance(user, dict) else None
        return data["token"], (None if raw_id is None else int(raw_id))

    def list_my_cvs(self, *, token: str) -> list[ExistingCvRecord]:
        """List existing CVs for idempotent upload recovery."""
        response = self._request_with_retry(
            "GET",
            "/api/students/me/cv",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            raise UnauthorizedSessionError()
        if response.status_code != 200:
            error_code, message = _extract_error_fields(response)
            raise IngestApiError(
                http_status=response.status_code,
                error_code=error_code,
                message=message,
                retryable=False,
            )

        envelope = _parse_api_envelope(response)
        items = envelope.get("data")
        if not isinstance(items, list):
            return []
        records: list[ExistingCvRecord] = []
        for entry in items:
            if not isinstance(entry, dict) or entry.get("id") is None:
                continue
            raw_size = entry.get("fileSize")
            records.append(
                ExistingCvRecord(
                    cv_id=int(entry["id"]),
                    original_file_name=str(
                        entry.get("originalFileName") or entry.get("fileName") or ""
                    ),
                    file_size=None if raw_size is None else int(raw_size),
                    is_active=bool(entry.get("isActive")),
                )
            )
        return records

    def upload_cv(
        self,
        *,
        token: str,
        file_path: Path,
        upload_filename: str,
    ) -> int:
        """Upload one PDF via POST /api/students/me/cv?active=true (no AI analyze call)."""
        file_bytes = Path(file_path).read_bytes()
        response = self._request_with_retry(
            "POST",
            "/api/students/me/cv",
            params={"active": "true"},
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (upload_filename, file_bytes, "application/pdf")},
        )
        if response.status_code == 401:
            raise UnauthorizedSessionError()
        if response.status_code not in (200, 201):
            error_code, message = _extract_error_fields(response)
            raise IngestApiError(
                http_status=response.status_code,
                error_code=error_code,
                message=message,
                retryable=False,
            )

        envelope = _parse_api_envelope(response)
        data = envelope.get("data")
        if not isinstance(data, dict) or data.get("id") is None:
            raise IngestApiError(
                http_status=response.status_code,
                error_code="INVALID_UPLOAD_PAYLOAD",
                message=f"Missing CV id in upload response: {json.dumps(envelope)[:200]}",
                retryable=False,
            )
        return int(data["id"])

    def get_cv_analysis(self, *, token: str, cv_id: int) -> CvAnalysisResult:
        """Fetch live analysis metadata via GET /api/students/me/cv/{cvId}/analysis."""
        response = self._request_with_retry(
            "GET",
            f"/api/students/me/cv/{cv_id}/analysis",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            raise UnauthorizedSessionError()
        if response.status_code != 200:
            error_code, message = _extract_error_fields(response)
            raise IngestApiError(
                http_status=response.status_code,
                error_code=error_code,
                message=message,
                retryable=False,
            )
        envelope = _parse_api_envelope(response)
        return _parse_cv_analysis_payload(envelope.get("data"), fallback_cv_id=cv_id)

    def reanalyze_cv(self, *, token: str, cv_id: int) -> CvAnalysisResult:
        """Trigger AI analysis via POST /api/students/me/cv/{cvId}/reanalyze.

        502 AI_SERVICE_INVALID_RESPONSE (AI 4xx domain rejection) is NOT retried and
        is surfaced with retryable=False so callers mark FAILED_PERMANENT immediately.
        """
        response = self._request_with_retry(
            "POST",
            f"/api/students/me/cv/{cv_id}/reanalyze",
            headers={"Authorization": f"Bearer {token}"},
            retry_statuses=_REANALYZE_TRANSIENT_HTTP_STATUSES,
        )
        if response.status_code == 401:
            raise UnauthorizedSessionError()
        if response.status_code != 200:
            error_code, message = _extract_error_fields(response)
            is_retryable = response.status_code in _REANALYZE_TRANSIENT_HTTP_STATUSES
            raise IngestApiError(
                http_status=response.status_code,
                error_code=error_code,
                message=message,
                retryable=is_retryable,
            )
        envelope = _parse_api_envelope(response)
        return _parse_cv_analysis_payload(envelope.get("data"), fallback_cv_id=cv_id)

    def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        retry_statuses: frozenset[int] = _TRANSIENT_HTTP_STATUSES,
        **kwargs: Any,
    ) -> httpx.Response:
        last_error: IngestApiError | None = None
        total_attempts = 1 + self.max_retries
        for attempt in range(total_attempts):
            try:
                response = self._client.request(method, url, **kwargs)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = IngestApiError(
                    http_status=None,
                    error_code=type(exc).__name__,
                    message=str(exc) or "Network error communicating with Backend",
                    retryable=True,
                )
            else:
                if response.status_code not in retry_statuses:
                    return response
                error_code, message = _extract_error_fields(response)
                last_error = IngestApiError(
                    http_status=response.status_code,
                    error_code=error_code,
                    message=message,
                    retryable=True,
                )

            if attempt + 1 < total_attempts:
                backoff = min(8.0, float(2**attempt)) + random.uniform(0.0, 0.25)
                self._sleep(backoff)

        assert last_error is not None
        raise last_error
