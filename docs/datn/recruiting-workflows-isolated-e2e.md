# W3-C1C — Isolated recruiting workflows browser suite

Historical W3-C1C baseline: master `d8174a8e308869e1287bf7cb7277f33f86c01503`. Branch: `test/datn-w3c1c-recruiting-workflows-e2e`. Worktree: `.worktrees/datn-w3c1c-recruiting-workflows-e2e`. Current V25 repair evidence is recorded separately below.

Run with Java21, Docker and the existing locked frontend/Playwright Chromium dependencies:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-recruiting-workflows-isolated-e2e.ps1 -JavaHome $env:JAVA_HOME
```

Only this dedicated suite runs. Maven compiles the test fixture without executing Backend tests. No other suites/fixtures, production Backend/Frontend/AI, released migrations or authentication are modified. No manual demo credentials, records or dataset helpers are read.

## Isolation and data

The test-only Java main starts PostgreSQL17 Testcontainers, requires exactly the 25 successful versioned Flyway migrations V1–V25 in order/current V25, validates checksums and starts the real Spring Boot application with Hibernate `ddl-auto=validate` with an explicit integration-only active profile on a random loopback port. Startup rejects pre-existing user/Company/Student/Job data and checks the five synthetic users, two Companies, two Students and six Jobs; the dev seeder is never used. Vite runs on an available strict loopback port, uses a per-run ignored optimizer cache and proxies this Backend. Its existing project config/plugins remain loaded; only process-local server/cache options are supplied. API base/proxy environment values are restored on exit. Synthetic Company/second Company, Student/second Student and Admin accounts have random passwords. All JWTs come from real login APIs; browser scenarios use the real login/logout UI.

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

The fixture atomically records ignored `ownership.json` before PostgreSQL startup, then adds the container ID before Spring startup or any later schema assertion. A unique `sjrs.recruiting.run` container label identifies this invocation even if startup fails before its ID is recorded. The runner signals only its own JVM, stops only its own Vite process and verifies process termination, owned container absence (including stopped containers) and temporary storage removal. It always writes sanitized `cleanup.json`, independently of readiness `fixture.json`. Missing/invalid ownership after JVM launch, failed Docker queries or any remaining owned resource make cleanup fail visibly. No Docker stop/remove/prune or PowerShell recursive storage deletion is added; Testcontainers/Java retain lifecycle ownership. `results.json` records PASS/FAIL/SKIPPED; `evidence.json` records sanitized actual methods/status codes/expectedStatus transitions; `late-response-evidence.json` records SQL-lock/cancellation evidence.

## W4-C1 — V25 repair and current verification (2026-11-12)

Verified remote master before worktree creation and again before delivery: `1158dd7abb8868f7fd03b74a3584ea78522de741`, unchanged from the requested baseline. Branch: `fix/datn-w4c1-recruiting-e2e-v25`; dedicated worktree: `.worktrees/datn-w4c1-recruiting-e2e-v25`. The root's existing buildinfo modification and untracked `.agents/`, `.worktrees/`, `skills-lock.json`, all other worktrees/manual services and demo storage were preserved.

Read W4-B's report and matrix from [Draft PR #96](https://github.com/binkadev/student-job-recommendation-system/pull/96), head `67c34a81fa1feefdd0a5c0ee0cdf96f99664f4be`, without merging/modifying that PR. Its two setup failures are historical evidence; the successful run below uses baseline production code plus this test-only repair.

Root cause: Java fixture line117 required current Flyway `24`; E01 also required an exact 24-version list. Master correctly applies released V25. Both assertions now require exactly V1–V25, not a lower bound. Java additionally checks PostgreSQL major17, every versioned migration in SUCCESS with a non-null checksum, SQL installed order, current V25, no pending migrations, Flyway validation and an open Hibernate EntityManagerFactory with `ddl-auto=validate`. E01's single changed assertion still uses exact list equality. Intermediate V23→V24 tests and released migrations are unchanged.

Four files change, all within this Recruiting suite: the test Java fixture, dedicated runner, the necessary one-line E01 schema expectation, and this document. Production Backend/Frontend/AI/Auth, V3 scoring/weights/tier ordering, dependencies, Playwright configuration, other suites and migration files do not change.

Environment: Windows PowerShell5.1, Microsoft Java21.0.11, Maven3.9.16, Node24.18.1/npm11.16.0, Docker Engine29.8.2, PostgreSQL17.11 (`postgres:17-alpine`), Playwright1.56.1/Chromium. Dependencies were installed in the new worktree using unchanged Frontend/E2E lockfiles, with no shared node_modules junction. The fixture explicitly activates only `integration` regardless of inherited dev settings.

Commands from the dedicated worktree root, sequentially:

```powershell
# Expected nonzero: actual Backend/PostgreSQL start and validate, then throw before readiness.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-recruiting-workflows-isolated-e2e.ps1 -JavaHome 'C:\Users\haiho\.jdks\ms-21.0.11' -SetupFailureProbe

# Real browser acceptance, no probe flag.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-recruiting-workflows-isolated-e2e.ps1 -JavaHome 'C:\Users\haiho\.jdks\ms-21.0.11'
```

Each invocation compiles with the existing focused command below (from `backend/`); both reported BUILD SUCCESS. No JUnit/Backend full regression, Frontend unit/build suite, AI tests, Core Smoke or other E2E suite was executed for W4-C1.

```powershell
.\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/recruiting-workflows-browser-classpath.txt'
```

PowerShell parser, Node spec syntax and `git diff --check` pass. An initial development invocation stopped at a PowerShell parse error before creating any stack; the extra brace was corrected before the actual probe and acceptance run recorded here. It is not counted as a cleanup probe or browser test result.

| Actual invocation | Owned run suffix | Result |
|---|---|---|
| Setup-failure probe | `c73e7a74e3fd49239ebe111249da7f7b` | Expected exit1; intentional Java exception before readiness; no fixture.json, Vite or browser execution |
| Recruiting acceptance | `44b707e3fa4b4bdeb12534143a60f128` | Exit0; **10 PASS, 0 FAIL, 0 SKIPPED, 0 retries**, 29.4s browser time |

Both runs' ignored `validation.json` confirms PostgreSQL major17, all 25 versions in order, current25, successfulVersionedMigrations25, flywayChecksumsValidated=true and hibernateSchemaValidation=true. These are fresh real migrations/schema validation, not mocked results.

| Cases | Current real HTTP/SQL evidence |
|---|---|
| E01–E03 | ONLINE interview creation/reload persistence, Student confirmation, Company cancellation and valid historical completion; terminal rejection400 |
| E04–E06 | Authorized applicant/saved-candidate launchers; distinct invitations; Student accepts/declines; no Application mutation |
| E07 | Actual409 INVITATION_ALREADY_PENDING, one PENDING row, retained draft, no automatic retry |
| E08 | Actual409 RECRUITMENT_STATE_CONFLICT, captured stale state retained until explicit manual reload |
| E09 | Real401/403 ownership/RBAC; real PostgreSQL table lock; one pending request, one cancellation on logout, current account only after release |
| E10 | Persisted reload, page2/deep lookup, foreign/unknown detail handling and actual403 API-error feedback |

All ten existing cases pass through React/Vite → Spring Boot → PostgreSQL with real JWT/login and no production HTTP/JWT/database mocks. Observed HTTP statuses include200/400/401/403/409. Cases use one worker and zero retries; no assertions were deleted, skipped or relaxed. Exactly the migration-list expectation advanced from24 to25.

Application/history integrity: all ten SQL snapshots match the initial full-row SHA-256 and count. Application rows remain **2 → 2**, digest `24f6cb2462f7ac92030bd28879c05037868bce2c3afa5ab9f9f47760fa45ecba` initially and finally. Final fixture counts remain five users/two Companies/two Students/six Jobs/one SavedCandidate. Interview/Invitation status changes are only the scenario's intended actions; no Application creation, history reset or automatic apply is introduced. This suite does not claim full-row preservation checks for every other table.

Both early-failure and success `cleanup.json` records contain explicit verified outcomes:

| Field | Probe | Success |
|---|---|---|
| status / clean | CLEAN / true | CLEAN / true |
| reason | INTENTIONAL_SETUP_FAILURE_BEFORE_READINESS | COMPLETED |
| runFailed / setupFailureProbe / fixtureReady | true / true / false | false / false / true |
| ownershipMetadataPresent / ownershipVerified / dockerVerified | true / true / true | true / true / true |
| ownedPostgresStopped / ownedPostgresRemoved | true / true | true / true |
| ownedJvmStopped / ownedViteStopped | true / true (Vite never started) | true / true |
| temporaryStorageRemoved / forcedJvmStop | true / false | true / false |
| errors | empty | empty |

Cleanup does not infer storage/container removal from JVM exit: it independently reads this run's ownership metadata, validates the owned temp prefix, checks physical absence and queries Docker by its unique label and exact recorded ID. Failure/unknown evidence produces status FAILED and nonzero exit. The probe retains its intentional nonzero run result even when cleanup is CLEAN. Metadata contains no credentials; its local private path remains ignored. Sanitized cleanup.json contains no storage paths, passwords, JWTs or private user data.

Ignored evidence directories: `e2e/.local/recruiting-workflows-<suffix>/` for the two suffixes above. Compile/server logs, ownership/readiness credentials, scenario state, SQL control replies and browser artifacts remain ignored and are not attached to the PR. Only fixed status/count/fingerprint evidence is reproduced here. Final inventory confirms all four pre-existing containers retain ID/image/StartedAt/state, all three volumes remain, all 13 pre-existing process PID/name records remain, and no new container/volume remains. All 25 migration-file SHA-256 values are unchanged. No demo PostgreSQL query, Docker daemon restart/prune, unrelated process termination or cleanup against pre-existing resources occurs; demo content hashes are not claimed.

**Release classification remains W4-B NOT READY.** W4-C1 supplies new focused evidence for the Recruiting blocker, pending independent review; it does not edit W4-B artifacts/PR #96 or resolve/formally risk-assess the dependency-security blocker. No academic relevance metrics or broader regression/production-readiness claim is made.

## Historical W3-C1C results (V24)

Final focused run (2026-11-11): **10 PASS, 0 FAIL, 0 SKIPPED**, Chromium one worker/zero retries, 31.9 seconds of browser checks. E01–E10 all passed using real Frontend/Backend HTTP; actual200/400/401/403/409 outcomes and captured transitions are recorded locally.

- Active profiles exactly `[integration]`; initial database has five synthetic users, two Companies, two Students, six Jobs, two Applications and one SavedCandidate, with no dev-seeder records.
- PostgreSQL17, exact V1–V24 migration list and Hibernate schema validation confirmed. Independent SQL status snapshots match API/UI persistence; the fingerprint and count of all Application rows remain unchanged.
- E09 observed one pending real browser request before logout, one cancellation, and only the second Company's records after releasing the real SQL lock.
- Final cleanup evidence: owned PostgreSQL stopped=true, JVM stopped=true, Vite stopped=true, temporary storage removed=true. Earlier failing setup runs also cleaned up their owned resources.

Focused harness fixes addressed an inherited dev profile, shared optimizer cache, connection-pool starvation from the test lock, transaction statistics snapshot caching and StrictMode request-observer timing. These fixes remain within the dedicated fixture/runner/spec; no security assertion was removed or relaxed and no case was skipped.

Remaining limits: controlled synthetic local deployment, one browser worker, and browser timezone aligned with the actual isolated JVM zone; this is not performance or multi-timezone deployment verification. This suite does not exercise AI scoring or the existing Core Smoke PRIMARY/FALLBACK issue. No public directory, password recovery, rescheduling, reminders, clock synchronization or automatic application creation is claimed.
