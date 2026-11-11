# Isolated Wave 2-B Company Profile and private documents E2E

Run from the repository root on Windows with Docker, Java 21, and the existing locked frontend/E2E dependencies plus Playwright Chromium installed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-company-verification-isolated-e2e.ps1 -JavaHome $env:JAVA_HOME
```

The dedicated runner compiles test code without running Maven tests. A new test-only Java main starts `postgres:17-alpine`, applies the real migrations and Hibernate validation, and starts the real Backend on a random loopback port under the integration profile. It creates synthetic Company owner, second Company, Admin and Student user accounts only inside that database. No demo credentials or dataset helpers are read. Vite receives this Backend as its proxy target and runs on an available loopback port with strict-port checking. There is no AI interaction in these profile/document scenarios and no Backend or AI mock.

Six ordered cases (one worker, no retries) cover:

1. Company size/logo/cover save, If-Match, reload persistence, broken/missing media fallback and preservation of other fields. Only image requests are controlled; API calls remain real.
2. Initially absent document, valid PDF multipart upload, shared revision/status refresh, unchanged PENDING status and byte-exact authenticated download.
3. PNG replacement, new byte-exact download, previous file cleanup, and absence of storage references from UI/public APIs.
4. Legitimate API profile update creates a stale browser draft; upload returns 409, retains selection, issues no automatic retry, and a manual reload captures the current ETag.
5. Admin sees selected-company absent/submitted status, downloads via JWT, and manually verifies the Company through the unchanged moderation controls.
6. Anonymous/Student/other-Company/Admin role boundaries, owner-only file resolution, exact private metadata shape, and no document metadata in public or generic Admin responses.

The cases intentionally share one synthetic owner's lifecycle; later cases report failures rather than being skipped when an earlier case fails. Use a fresh runner invocation for another run; do not run this spec directly against an existing service.

Private document storage is a unique OS temporary directory outside the repository, distinct from CV storage. The suite reads only its own storage directory to verify bytes, replacement and cleanup. The Java fixture closes its own Backend/Testcontainer and removes only the directory it created. The runner stops only its recorded child processes, signals normal fixture shutdown first, and records/validates storage removal and container termination. It never stops unrelated services or uses a manually configured database.

Credentials, generated PDF/PNG, logs, browser output, JSON results/evidence and cleanup evidence are under a unique `e2e/.local/company-verification-*` directory covered by the existing gitignore. Playwright traces/videos are disabled; credentials/tokens are never deliberately logged. Blob downloads are compared in memory, with no public document preview. Failure screenshots and diagnostics remain ignored. The `cleanup.json` file is the final owned-resource cleanup evidence.

The pre-existing Core Smoke PRIMARY/FALLBACK fixture issue is outside this suite and remains unchanged.

## Recorded verification (2026-11-11)

Final isolated run: **6 passed, 0 failed, 0 skipped** (Chromium, 13.4 seconds of browser checks). Real multipart uploads, JWT-authenticated binary downloads, PostgreSQL persistence/shared revisions, and private filesystem bytes/replacement cleanup were exercised. The runner's final `cleanup.json` confirmed all four conditions: owned PostgreSQL stopped, temporary storage removed, owned JVM stopped, and owned Vite stopped.

Setup needed two focused test-harness corrections before the final passing run; no production changes or other suites were run. All generated evidence remains ignored; only the fixture, runner, config/spec and this document are committed. Existing worktrees and the root workspace's uncommitted changes were preserved.
