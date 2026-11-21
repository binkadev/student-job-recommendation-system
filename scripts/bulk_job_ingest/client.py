"""Thread-safe httpx client for Company verification, Skills sync, and Job ingestion."""

from __future__ import annotations

from collections.abc import Callable
import random
import threading
import time
from typing import Any

import httpx

_TRANSIENT_HTTP_STATUSES = frozenset({408, 429, 500, 502, 503, 504})


class JobIngestApiError(Exception):
    """Structured error raised on Backend API or transport failure."""

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
    """Raised when POST /api/auth/register returns 409 EMAIL_ALREADY_EXISTS."""


class UnauthorizedSessionError(Exception):
    """Raised when an existing JWT receives 401 UNAUTHORIZED."""


def _parse_envelope(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _extract_error(response: httpx.Response) -> tuple[str, str]:
    payload = _parse_envelope(response)
    code = payload.get("errorCode")
    msg = payload.get("message")
    if not isinstance(code, str) or not code:
        code = f"HTTP_{response.status_code}"
    if not isinstance(msg, str) or not msg:
        msg = response.text[:300] or f"HTTP status {response.status_code}"
    return code, msg


class BackendJobIngestClient:
    """Persistent httpx client managing Admin + Company API flows safely."""

    def __init__(
        self,
        base_url: str,
        *,
        admin_email: str,
        admin_password: str,
        max_concurrency: int = 8,
        timeout_seconds: float = 30.0,
        max_retries: int = 4,
        transport: httpx.BaseTransport | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.admin_email = admin_email
        self.admin_password = admin_password
        self.max_retries = max(0, max_retries)
        self._sleep = sleep_fn
        self._admin_lock = threading.Lock()
        self._admin_token: str | None = None
        limits = httpx.Limits(
            max_connections=max(max_concurrency + 6, 12),
            max_keepalive_connections=max(max_concurrency + 4, 10),
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

    def __enter__(self) -> BackendJobIngestClient:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def check_health(self) -> None:
        try:
            response = self._request_with_retry("GET", "/api/public/statistics")
        except JobIngestApiError as exc:
            raise RuntimeError(
                f"Backend preflight health check failed at {self.base_url}: {exc}"
            ) from exc
        if response.status_code != 200:
            raise RuntimeError(
                f"Backend health check returned HTTP {response.status_code}"
            )

    def get_admin_token(self) -> str:
        with self._admin_lock:
            if self._admin_token is None:
                token, _ = self.login(
                    email=self.admin_email, password=self.admin_password
                )
                self._admin_token = token
            return self._admin_token

    def refresh_admin_token(self, stale_token: str) -> str:
        with self._admin_lock:
            if self._admin_token is None or self._admin_token == stale_token:
                token, _ = self.login(
                    email=self.admin_email, password=self.admin_password
                )
                self._admin_token = token
            return self._admin_token

    def login(self, *, email: str, password: str) -> tuple[str, int | None]:
        response = self._request_with_retry(
            "POST",
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        envelope = _parse_envelope(response)
        data = envelope.get("data")
        if not isinstance(data, dict) or not isinstance(data.get("token"), str):
            raise JobIngestApiError(
                http_status=200,
                error_code="INVALID_LOGIN_PAYLOAD",
                message="Login response missing token",
                retryable=False,
            )
        user = data.get("user") or {}
        raw_id = user.get("id") if isinstance(user, dict) else None
        return data["token"], (None if raw_id is None else int(raw_id))

    def register_company(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        company_name: str,
    ) -> int | None:
        response = self._request_with_retry(
            "POST",
            "/api/auth/register",
            json={
                "email": email,
                "password": password,
                "role": "COMPANY",
                "fullName": full_name,
                "companyName": company_name,
            },
        )
        if response.status_code == 201:
            data = _parse_envelope(response).get("data") or {}
            raw_id = data.get("id") if isinstance(data, dict) else None
            return None if raw_id is None else int(raw_id)
        if response.status_code == 409:
            code, msg = _extract_error(response)
            if code == "EMAIL_ALREADY_EXISTS":
                raise EmailAlreadyExistsError()
            raise JobIngestApiError(
                http_status=409,
                error_code=code,
                message=msg,
                retryable=False,
            )
        code, msg = _extract_error(response)
        raise JobIngestApiError(
            http_status=response.status_code,
            error_code=code,
            message=msg,
            retryable=False,
        )

    def get_company_me(self, *, token: str) -> tuple[int, str]:
        response = self._request_with_retry(
            "GET",
            "/api/companies/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 401:
            raise UnauthorizedSessionError()
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data")
        if not isinstance(data, dict) or data.get("id") is None:
            raise JobIngestApiError(
                http_status=200,
                error_code="INVALID_COMPANY_PAYLOAD",
                message="GET /api/companies/me missing company id",
                retryable=False,
            )
        return int(data["id"]), str(data.get("status") or "")

    def verify_company_as_admin(
        self, *, company_id: int, status: str = "VERIFIED"
    ) -> str:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "PATCH",
                f"/api/admin/companies/{company_id}/status",
                headers={"Authorization": f"Bearer {token}"},
                json={"status": status},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data") or {}
        return str(data.get("status") or status)

    def list_skills_page(
        self, *, token: str, page: int, size: int = 100
    ) -> tuple[list[dict[str, Any]], int]:
        response = self._request_with_retry(
            "GET",
            "/api/skills",
            params={"page": page, "size": size},
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data") or {}
        items = data.get("items") or []
        total_pages = int(data.get("totalPages") or 1)
        return list(items), total_pages

    def list_skills_page_as_admin(
        self, *, page: int, size: int = 100
    ) -> tuple[list[dict[str, Any]], int]:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "GET",
                "/api/skills",
                params={"page": page, "size": size},
                headers={"Authorization": f"Bearer {token}"},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data") or {}
        return list(data.get("items") or []), int(data.get("totalPages") or 1)

    def create_skill_as_admin(
        self, *, token: str, name: str, category: str
    ) -> dict[str, Any]:
        response = self._request_with_retry(
            "POST",
            "/api/skills",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": name, "category": category},
        )
        if response.status_code not in (200, 201):
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        return dict(_parse_envelope(response).get("data") or {})

    def create_skill_as_admin_auto(
        self, *, name: str, category: str
    ) -> dict[str, Any]:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "POST",
                "/api/skills",
                headers={"Authorization": f"Bearer {token}"},
                json={"name": name, "category": category},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code not in (200, 201):
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        return dict(_parse_envelope(response).get("data") or {})

    def create_job_as_admin(self, *, payload: dict[str, Any]) -> int:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "POST",
                "/api/jobs",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code not in (200, 201):
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data")
        if not isinstance(data, dict) or data.get("id") is None:
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code="INVALID_JOB_PAYLOAD",
                message="POST /api/jobs missing created job id",
                retryable=False,
            )
        return int(data["id"])

    def update_job_status_as_admin(
        self, *, job_id: int, status: str
    ) -> str:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "PATCH",
                f"/api/jobs/{job_id}/status",
                headers={"Authorization": f"Bearer {token}"},
                json={"status": status},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data") or {}
        return str(data.get("status") or status)

    def search_jobs_as_admin(
        self,
        *,
        keyword: str,
        status: str,
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[dict[str, Any]], int]:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "GET",
                "/api/jobs",
                params={
                    "keyword": keyword,
                    "status": status,
                    "page": page,
                    "size": size,
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data") or {}
        return list(data.get("items") or []), int(data.get("totalPages") or 1)

    def list_jobs_page_as_admin(
        self,
        *,
        status: str = "ACTIVE",
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[dict[str, Any]], int]:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "GET",
                "/api/jobs",
                params={"status": status, "page": page, "size": size},
                headers={"Authorization": f"Bearer {token}"},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        data = _parse_envelope(response).get("data") or {}
        return list(data.get("items") or []), int(data.get("totalPages") or 1)

    def get_job_detail_as_admin(self, *, job_id: int) -> dict[str, Any]:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "GET",
                f"/api/jobs/{job_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        return dict(_parse_envelope(response).get("data") or {})

    def update_job_as_admin(
        self, *, job_id: int, payload: dict[str, Any]
    ) -> dict[str, Any]:
        def _call(token: str) -> httpx.Response:
            return self._request_with_retry(
                "PUT",
                f"/api/jobs/{job_id}",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )

        token = self.get_admin_token()
        response = _call(token)
        if response.status_code == 401:
            token = self.refresh_admin_token(token)
            response = _call(token)
        if response.status_code != 200:
            code, msg = _extract_error(response)
            raise JobIngestApiError(
                http_status=response.status_code,
                error_code=code,
                message=msg,
                retryable=False,
            )
        return dict(_parse_envelope(response).get("data") or {})

    def _request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs: Any,
    ) -> httpx.Response:
        last_error: JobIngestApiError | None = None
        total_attempts = 1 + self.max_retries
        for attempt in range(total_attempts):
            try:
                response = self._client.request(method, url, **kwargs)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = JobIngestApiError(
                    http_status=None,
                    error_code=type(exc).__name__,
                    message=str(exc) or "Network error communicating with Backend",
                    retryable=True,
                )
            else:
                if response.status_code not in _TRANSIENT_HTTP_STATUSES:
                    return response
                code, msg = _extract_error(response)
                last_error = JobIngestApiError(
                    http_status=response.status_code,
                    error_code=code,
                    message=msg,
                    retryable=True,
                )

            if attempt + 1 < total_attempts:
                backoff = min(8.0, float(2**attempt)) + random.uniform(0.0, 0.25)
                self._sleep(backoff)

        assert last_error is not None
        raise last_error
