# W3-C2C — Isolated Application Messaging E2E

Baseline: `master@bf4fd415bee1d8829b137cabadcc06e7ad43595f` (merged Frontend PR #93). Branch: `test/datn-w3c2c-application-messaging-e2e`. Dedicated worktree: `.worktrees/datn-w3c2c-application-messaging-e2e`.

## Scope and reproducibility

Five test-infrastructure files only:

- `backend/src/test/java/com/tttn/jobrecommendation/integration/ApplicationMessagingBrowserFixture.java`
- `scripts/run-application-messaging-isolated-e2e.ps1`
- `e2e/application-messaging-isolated.playwright.config.mjs`
- `e2e/diagnostics/application-messaging-isolated.spec.mjs`
- This document.

Production Backend, Frontend, Auth, AI, Flyway V1–V25 and other isolated suites are unchanged. Password recovery remains excluded. Core Smoke PRIMARY/FALLBACK is an independent known issue and was neither run nor changed.

The dedicated runner compiles the fixture using Maven `test-compile` and dependency-plugin `build-classpath`; it does not execute JUnit or other Backend tests. Existing lockfile dependencies and Chromium must be available. Run from the worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-application-messaging-isolated-e2e.ps1 -JavaHome 'C:\Users\haiho\.jdks\ms-21.0.11' -TemporaryBase 'D:\'
```

`-JavaHome` defaults to JAVA_HOME. `-TemporaryBase` defaults to the OS temp directory and may select a different disk. This execution used D: because C: had insufficient space for another full npm install. The new worktree references the existing identical-lockfile Frontend node_modules through a junction; no existing dependency/worktree files were modified. Every Vite run has its own optimizer cache in its owned scratch directory. E2E dependencies were installed in the new worktree using its lockfile. There is no package/lockfile change.

One Chromium worker, zero retries, 60-second per-case timeout and 12-second expect timeout. The suite ran **once: 10 PASS, 0 FAIL, 0 SKIPPED (32.7 seconds browser time)**. Fixture compilation reported BUILD SUCCESS. No other Playwright, Backend regression, AI, Core Smoke, Frontend build or unit suite was run.

## Real isolation and data

Each run starts a disposable `postgres:17-alpine` Testcontainer and the real Spring Boot application on a random 127.0.0.1 port, with exactly the integration profile and Hibernate `ddl-auto=validate`. Startup rejects a nonempty account/company/student/job database before seeding. Explicit datasource credentials point only to the newly created Testcontainer. No demo credentials, databases, fixture datasets, manual services or AI mocks are used.

SQL confirms PostgreSQL major 17 and exactly successful Flyway versions 1–25, with no pending migrations. Flyway checksum validation succeeds at startup and snapshots; SQL migration checksums are compared to the initial history throughout. Hibernate schema validation completes before fixture readiness.

Synthetic fixture: two VERIFIED Companies, two Students, one Admin; five random passwords generated at startup and real BCrypt hashes. There are 108 Jobs and 108 legitimate Applications: two REVIEWED, one WITHDRAWN and 105 REJECTED. Each Application has a separate Job, avoiding active-pair/reapplication uniqueness violations. Timestamps are assigned only during initial fixture setup; no history row is reset during scenarios. A CV and nonempty Interview/Invitation provide meaningful preservation checks. Initial 105 owner historical conversations plus one foreign conversation require multiple metadata pages; 25 same-timestamp messages exercise chronological ID tie-breaking.

Backend/Vite listen only on dedicated available loopback ports. strictPort rejects a collision without touching its owner. Private verification/CV storage, build output, browser temporary data and optimizer cache belong to a unique per-run scratch directory outside tracked source. Random credentials, in-memory real JWTs, full SQL replies and any failure screenshots stay local/ignored. Trace and video are disabled.

## Scenario results

| Case | Result | Runtime evidence |
|---|---|---|
| M01 | PASS | Student UI login; owned Application GET 200; POST contains only applicationId; navigation and one correct persisted conversation |
| M02 | PASS | Company UI launcher reuses the same ID; no duplicate row; both owned lists contain it |
| M03 | PASS | Student multiline Unicode/whitespace preserved in actual POST; Company manually refreshes; text, identity and timestamp match SQL |
| M04 | PASS | Company reply has JWT-derived Company sender; Student reload shows chronological message IDs; each success inserts one row |
| M05 | PASS | Explicit bodyless PATCH marks only incoming messages; counts 1, then 0; later incoming message stays unread until another explicit read; outgoing remains untouched |
| M06 | PASS | Original participants can reuse REJECTED history/create WITHDRAWN conversation; histories remain distinct across reload/new login; no Application writes |
| M07 | PASS | Deep metadata lookup reaches page 2 at size 100; no invented detail GET; message pages 1/2/3 and latest navigation match SQL including timestamp ties; foreign/unknown links expose no content |
| M08 | PASS | Real 401/403/404 and 400 responses for unauthorized/foreign/Admin, invalid content and forged fields; scoped counts/lists and public responses leak no private messages |
| M09 | PASS | Genuine Chromium offline POST fails at transport, draft survives, no automatic retry; SQL proves no commit; successful manual latest-history refresh and confirmation precede one manual resend |
| M10 | PASS | Fixture-only PostgreSQL messages-table lock holds real history GET; pg_stat_activity confirms a waiting query; logout cancels it; second Student sees only its own conversation, with no first-account draft/content |

All case passes depend on real UI/HTTP behavior and independent PostgreSQL snapshots. HTTP/JWT/Backend responses are never fulfilled or mocked. GET history does not mark read. Actual requests use the five V25 endpoints through the running Frontend/Backend. Sanitized protocol evidence records methods, paths and statuses only: success 200; unauthorized 401; foreign/Admin 403; unknown resource 404; validation/spoofing 400; one failed offline POST. Navigation/StrictMode also cancels read requests naturally. Asset cancellations were ERR_ABORTED from intentional navigation; there were no asset HTTP errors.

## SQL integrity and counts

Each database snapshot checks unchanged full-row SHA-256 fingerprints and counts for Applications, Jobs, CVs, Interviews and Invitations. No scenario creates an Application. Final counts:

| Data | Initial | Final | Preservation |
|---|---:|---:|---|
| Applications | 108 | 108 | Identical full-row SHA-256 |
| Jobs | 108 | 108 | Identical full-row SHA-256 |
| CV files | 1 | 1 | Identical full-row SHA-256 |
| Interviews | 1 | 1 | Identical full-row SHA-256 |
| Invitations | 1 | 1 | Identical full-row SHA-256 |
| Conversations | 106 | 108 | Exactly the two expected new conversations |
| Messages | 26 | 31 | Exactly five confirmed successful sends |

Application fingerprint for the passing run: `4215778f1a4b172eda97a6a5f37db6935442a604d6dd1fd56a5fb4c586c37a41` (initial = final). Other fingerprints remain in ignored per-run SQL summaries; no message body is copied into this document. Conversation/Application/Company/Student tuple mismatch count, sender mismatch count and last-message/max-message timestamp mismatch count all remain **0**. Sender user IDs, roles, original content, timestamps and recipient read flags are compared independently to SQL rows.

## Failures, session safety and cleanup

M09 uses actual browser offline transport, not a fake HTTP error response. SQL confirms that particular offline attempt did not reach persistence. This does **not** cover after-commit response loss or prove exactly-once message delivery; V25 has no client idempotency key. The UI deliberately requires checking current history before resending.

M10 uses a dedicated fixture-only JDBC connection and an ACCESS EXCLUSIVE lock on the disposable messages table. A 30-second watchdog rolls it back independently; normal/failure paths release it in finally. File-based test control is not an HTTP endpoint or production bypass. One live request was confirmed waiting before account switch; one was cancelled. After release, only the new account's own conversation was visible and all prior private message/draft content was absent.

Before the browser run, the same runner's `-CleanupProbe` option intentionally threw after Backend and Vite startup to test failure cleanup. It returned the expected nonzero exit before Playwright, with all cleanup checks true. The normal passing run also recorded all checks true:

- Owned PostgreSQL stopped; owned JVM and Vite stopped.
- Dedicated CV/private-document storage removed.
- Owned scratch directory (optimizer cache, build/browser temporary files) removed.
- Only this run's build-output junction removed without following it recursively.

The runner tracks exact started process objects and the fixture-owned container ID; it never enumerates/kills unrelated services. Recursive cleanup verifies absolute paths remain under the owned scratch root and match generated prefixes. Existing worktrees and initial root changes (`frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `.worktrees/`, `skills-lock.json`) are preserved. No manual/demo database connection or reseeding occurs.

Ignored evidence: each run prints its `e2e/.local/application-messaging-<run-id>/` directory, containing fixture/ownership metadata, compile/server/Vite logs, Playwright results, sanitized method/path/status evidence, SQL-integrity/network/session summaries and cleanup.json. Full SQL replies contain synthetic private content and are intentionally ignored; do not attach them or credentials to a PR. No authenticated traces/videos, node_modules, build output, raw bodies or private storage paths are committed.
