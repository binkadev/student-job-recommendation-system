# W3-C1C — Isolated recruiting workflows browser suite

Baseline: master `d8174a8e308869e1287bf7cb7277f33f86c01503`. Branch: `test/datn-w3c1c-recruiting-workflows-e2e`. Worktree: `.worktrees/datn-w3c1c-recruiting-workflows-e2e`.

Run with Java21, Docker and the existing locked frontend/Playwright Chromium dependencies:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-recruiting-workflows-isolated-e2e.ps1 -JavaHome $env:JAVA_HOME
```

Only this dedicated suite runs. Maven compiles the test fixture without executing Backend tests. No existing suites/fixtures, production Backend/Frontend/AI, released migrations or authentication are modified. No manual demo credentials, records or dataset helpers are read.

## Isolation and data

The test-only Java main starts PostgreSQL17 Testcontainers, applies and validates Flyway V1–V24 and starts the real Spring Boot application with Hibernate `ddl-auto=validate` with an explicit integration-only active profile on a random loopback port. Startup rejects pre-existing user/Company/Student/Job data and checks the five synthetic users, two Companies, two Students and six Jobs; the dev seeder is never used. Vite runs on an available strict loopback port, uses a per-run ignored optimizer cache and proxies this Backend. Its existing project config/plugins remain loaded; only process-local server/cache options are supplied. API base/proxy environment values are restored on exit. Synthetic Company/second Company, Student/second Student and Admin accounts have random passwords. All JWTs come from real login APIs; browser scenarios use the real login/logout UI.

Controlled fixtures have VERIFIED Companies, owned ACTIVE Jobs with future deadlines, coherent historical REVIEWED Applications and a Company/Student/Application-matching SavedCandidate. Historical timeline setup happens once before scenarios. It does not reset protected Application history. A past CONFIRMED interview provides an elapsed-duration completion case. 101 terminal historical records per workflow exercise details beyond the first 100-record lookup page. New actions use legitimate production APIs; no moderation/verification bypass endpoint is introduced or exercised.

Future scheduling time and timezone are read from the actual JVM clock/zone. Chromium uses that same zone for display hints, without changing Backend/global clocks. LocalDateTime values have no UTC offset; input timestamps are checked against the actual JSON payload. Historical fixtures avoid clock mocks and long waits.

Private/CV filesystem roots are dedicated OS temporary directories outside the repository. Credentials, state, logs, snapshots and browser evidence are in a unique ignored `e2e/.local/recruiting-workflows-*` directory. Traces/videos are off; failure screenshots stay ignored. Committed files contain only synthetic fixture definitions, test code and documentation. Evidence excludes JWTs, headers, passwords and message/note contents.

## E01–E10

1. Real Company UI schedules an ONLINE interview from an owned Application; exact POST payload/200, API persistence, browser reload and independent SQL status are checked.
2. Student list/detail confirms SCHEDULED→CONFIRMED with captured expectedStatus; Company/Student APIs and SQL agree.
3. Company cancels a separate interview; terminal UI/API actions are rejected. A valid historical CONFIRMED interview is completed after its duration.
4. Applicant detail launcher resolves the owned Application and creates a PENDING invitation for an owned Job; the source Application stays unchanged.
5. Saved-candidate launcher re-fetches the same authorized Application association and creates a distinct invitation for another owned Job.
6. Student accepts one invitation and declines another, reloads persisted status and follows normal Job navigation. No Application is created/changed.
7. A real duplicate returns409 INVITATION_ALREADY_PENDING; draft/Job remain, one outstanding PENDING row exists and no automatic retry occurs.
8. Separate legitimate API cancellation makes the browser stale; the UI receives409 RECRUITMENT_STATE_CONFLICT, keeps captured data/action and reloads only on explicit user request.
9. Anonymous/wrong-role/foreign ownership requests are rejected, lists stay scoped, and a real delayed PostgreSQL query is cancelled/discarded while the browser signs out and signs into the second Company.
10. Lists/details survive reload, deep lookup reaches page2 via authorized bounded endpoints, unknown/foreign IDs show no fabricated records, and a real403 owned-source API failure displays an error rather than a successful empty list.

One worker, zero retries, bounded timeouts, no skipped cases or Backend/JWT/API/database mocks. Cases form a single synthetic lifecycle; generated IDs persist in ignored scenario state so a worker restart does not fabricate prerequisites. An upstream failure is reported as a failure, never silently skipped or replaced by fake data.

## Independent evidence and late responses

A file-only test-fixture control channel supports SQL snapshots and a bounded temporary ACCESS EXCLUSIVE lock on the interviews table. It is not an HTTP endpoint, is only present in the test main and cannot target another database. The lock uses a separate fixture-only JDBC connection to the same disposable PostgreSQL, leaving the production Hikari pool configuration unchanged. It delays actual unmodified HTTP handlers/SQL rather than intercepting or fulfilling browser requests. Request/failure observers are attached before navigation to account for real StrictMode requests. PostgreSQL waiters are observed after clearing the transaction statistics snapshot on each probe, account switching cancels the old request, then the lock is released and the new account's real records render. A 25-second watchdog and finally blocks release locks on failure.

Snapshots independently query PostgreSQL status/owner IDs, exact applied migration versions and PostgreSQL major. A SHA-256 fingerprint of all Application rows plus their count must match the initial fixture snapshot after every scenario that checks persistence; no private Application contents are written into evidence.

The runner signals only its own JVM, stops only its own Vite PID, and verifies their termination, its container stopped and temporary storage removed in `cleanup.json`, including after suite failure. `results.json` records PASS/FAIL/SKIPPED; `evidence.json` records sanitized actual methods/status codes/expectedStatus transitions; `late-response-evidence.json` records SQL-lock/cancellation evidence.

## Results

Final focused run (2026-11-11): **10 PASS, 0 FAIL, 0 SKIPPED**, Chromium one worker/zero retries, 31.9 seconds of browser checks. E01–E10 all passed using real Frontend/Backend HTTP; actual200/400/401/403/409 outcomes and captured transitions are recorded locally.

- Active profiles exactly `[integration]`; initial database has five synthetic users, two Companies, two Students, six Jobs, two Applications and one SavedCandidate, with no dev-seeder records.
- PostgreSQL17, exact V1–V24 migration list and Hibernate schema validation confirmed. Independent SQL status snapshots match API/UI persistence; the fingerprint and count of all Application rows remain unchanged.
- E09 observed one pending real browser request before logout, one cancellation, and only the second Company's records after releasing the real SQL lock.
- Final cleanup evidence: owned PostgreSQL stopped=true, JVM stopped=true, Vite stopped=true, temporary storage removed=true. Earlier failing setup runs also cleaned up their owned resources.

Focused harness fixes addressed an inherited dev profile, shared optimizer cache, connection-pool starvation from the test lock, transaction statistics snapshot caching and StrictMode request-observer timing. These fixes remain within the dedicated fixture/runner/spec; no security assertion was removed or relaxed and no case was skipped.

Remaining limits: controlled synthetic local deployment, one browser worker, and browser timezone aligned with the actual isolated JVM zone; this is not performance or multi-timezone deployment verification. This suite does not exercise AI scoring or the existing Core Smoke PRIMARY/FALLBACK issue. No public directory, password recovery, rescheduling, reminders, clock synchronization or automatic application creation is claimed.
