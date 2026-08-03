# Final Verification Evidence

- Base commit: `56a21db4e99815dbcfd25d4da6ca9f7bd404cd69`
- Branch: `chore/final-regression-demo-package`
- Verification date: 2026-08-03
- Environment: Windows 11; PowerShell; Docker Desktop 4.77.0 / Engine
  29.5.3; Docker Compose 5.1.4; Maven 3.9.16 with Java 21.0.11 from
  JAVA_HOME; Python 3.11.9; Node.js 24.18.1; npm 11.16.0.

## Verification results

| Area | Command | Result |
|---|---|---|
| Backend | `cd backend; .\mvnw.cmd -B -ntp clean verify` | PASS, exit 0; 388 tests total, 0 failures, 0 errors, 0 skips |
| Backend split | Surefire / Failsafe reports | 197 / 191 tests, both 0 failures, 0 errors, 0 skips |
| AI install | `python -m pip install --require-hashes --only-binary=:all: -r requirements.lock` | PASS, exit 0 |
| AI dependency check | `python -m pip check` | PASS, no broken requirements |
| AI tests | `python -m pytest` | PASS, exit 0; 646 passed, 1 warning |
| Frontend install | `npm.cmd ci` | PASS, exit 0; 397 packages installed |
| Frontend tests | `npm.cmd run test:run` | PASS, exit 0; 4 files and 51 tests passed |
| Frontend lint | `npm.cmd run lint` | PASS, exit 0 |
| Frontend build | `npm.cmd run build` | PASS, exit 0 |
| Normal Compose | `docker compose config` | PASS, exit 0; local .env effective PostgreSQL host port 55432 |
| E2E Compose | `docker compose -f docker-compose.yml -f docker-compose.e2e.yml config` | PASS, exit 0 |
| Real E2E | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-candidate-ranking-real-e2e.ps1` | PASS, exit 0 |

## Real E2E evidence

The isolated runner proved:

- PostgreSQL, AI Service, and Backend containers became healthy.
- Company registration returned 201 and login returned 200.
- Candidate Ranking create, history list, and detail requests returned 200.
- Exactly one real AI `POST /internal/v2/candidate-rankings` returned 200.
- The run used real same-language and cross-language scoring.
- The run finished as `SUCCESS`; scanned 3, eligible 3, skipped 0, returned
  3, and persisted 3 results.
- Results were deterministic, complete, and ordered with Backend-owned ranks.
- The isolated Compose project, network, containers, and volumes were removed.
- The normal development project remained healthy after cleanup.

The output was sanitized: no JWT, API key, password, raw CV/Job text, or
private personal data was recorded.

## Warnings and retry notes

Non-blocking warnings:

- Backend JVM/Mockito dynamic-agent warning about future JDK agent loading.
- AI Starlette deprecation warning for httpx TestClient.
- npm pending esbuild install-script notice.
- Vite large-chunk advisory for the production bundle.

The first Backend attempt could not access Maven Central from the sandbox; the
one-time escalated CI-equivalent rerun passed. The first PowerShell npm.ps1
`npm ci` attempt was blocked by Windows execution policy; the successful
`npm.cmd ci` command is recorded above. Sandboxed Vitest/build invocations
also required the one-time escalated reruns. These were environment/tooling
access issues, not repository test failures.

## Final conclusion

`READY WITH NAMED LIMITATIONS`

The repository is ready for a controlled graduation demonstration based on the
verification above. It is not production-ready: the limitations in
[known-limitations.md](known-limitations.md), incomplete full manual browser
journey, absent human-labeled ranking-quality evaluation, and unproven
production operations remain explicit.
