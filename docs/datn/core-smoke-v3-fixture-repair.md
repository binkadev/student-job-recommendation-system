# W4-A ? Core Smoke V3 fixture repair

Baseline: master `6e2720006bffae4b50cf08780a47b56e7cc3a0a6`; branch `fix/datn-w4a-core-smoke-v3-fixture`; dedicated worktree `.worktrees/datn-w4a-core-smoke-v3-fixture`.

## Proven root cause

[Core Smoke CI run 43064090865](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43064090865), job 130674222055, failed at the existing assertion requiring one PRIMARY and one FALLBACK. Its build and V1-V25 migration stages had succeeded.

The stale fixture registered a Company and inserted two ACTIVE Jobs directly, assuming registration implied verification. Current AuthServiceImpl creates Company PENDING. EligibleJobCorpusV3Builder calls JobRepository with ACTIVE + VERIFIED + an unexpired/null deadline. RecommendationGenerationServiceImpl deliberately completes an empty corpus without calling AI.

This was independently reproduced on a fresh isolated PostgreSQL/Backend/FastAPI stack after making resource ownership safe, before repairing the fixture:

| Runtime observation | Before repair | After repair |
|---|---|---|
| Company immediately after registration | PENDING | PENDING |
| Company at generation | PENDING | VERIFIED through Admin API |
| Fixture Jobs | Two ACTIVE, same owning Company, null deadlines | Two ACTIVE, same owning Company, valid future deadlines |
| Eligible Job count | 0 | 2 |
| Public generation | HTTP 200, SUCCESS | HTTP 200, SUCCESS |
| Result count / PRIMARY / FALLBACK | 0 / 0 / 0 | 2 / 1 / 1 |
| Internal V3 recommendation requests | 0 | Exactly 1, HTTP 200 |
| Internal V2 recommendation requests | 0 | 0 |

The original assertion failed unchanged in the baseline. This is an invalid fixture, not an AI scoring or Backend eligibility regression.

## Repair and boundaries

Only the smoke child runner, Core Smoke workflow and this document change. Production Backend, Frontend, Auth, AI/V3 and V1-V25 migrations are unchanged; password recovery remains excluded.

- Public Student/Company registration and real JWT login remain in use. Company registration must still return PENDING.
- A NEW synthetic Admin is bootstrapped only in the freshly created disposable database. It reuses the random fixture password's BCrypt hash from the synthetic Student; no existing identity is promoted and no hash/token/password is logged. There is no public Admin registration or production bypass.
- Company creates both Jobs as DRAFT through POST /api/jobs. Only Admin PATCH /api/admin/companies/{id}/status verifies the Company. Each Job then follows Company DRAFT -> PENDING_APPROVAL and Admin PENDING_APPROVAL -> ACTIVE.
- Real negative requests assert HTTP 403 for Company self-verification, submission while PENDING and self-publishing ACTIVE. Both Job IDs and public eligibility are checked independently.
- SQL only prepares the existing synthetic skill/CV snapshot and the new test Admin; it no longer inserts ACTIVE Jobs or directly updates Company verification.
- All original score/tier/rank/skill/persistence/AI-count assertions remain, including the exact two-result assertion. Additional checks require exactly one result per tier, two scanned Jobs, 0.65/0.35 weighting at NUMERIC(8,5) precision, both persisted rows matching API fields, public read-back, one completed run and no PROCESSING rows globally.

Windows PowerShell 5 decorates arrays returned by ConvertFrom-Json with ETS properties. Exact skill DTO records are rebuilt before serialization, avoiding an invalid value/Count object; the four-skill assertion remains strict. UTF-8/BOM script encoding and UTF-8 HTTP bodies preserve the original Vietnamese fixture text on Windows and PowerShell 7.

## Owned stack and workflow

The old runner used a fixed Compose project name and ran down --volumes --remove-orphans before startup. It could target another invocation's resources and fixed ports could collide.

Each invocation now generates a unique project, explicit owned volume/image names, random credentials and internal keys, and an ignored env/Compose override under e2e/.local/core-smoke-<id>/. It never reads demo credentials. Backend and AI publish random loopback ports; PostgreSQL is not published. A fresh-user-table guard rejects reused/seeded data; profile e2e disables the dev seeder, and a test-only runtime override enables Hibernate schema validation.

There is no pre-start down. Cleanup runs after successful or partially failed startup, only for the generated project and its unique image tags, without force/prune or orphan cleanup of unknown resources. Containers, volumes and networks are checked absent afterward. The existing explicit KeepE2EStack debug flag remains opt-in and was not used.

The workflow now watches the child runner and docker-compose.e2e.yml as well as the wrapper, so this actual repair is validated. It delegates startup/cleanup to the owned runner instead of creating a second default dev stack and printing unrelated-stack diagnostics. Failure reporting reads only sanitized diagnostics.json/cleanup.json, never the generated secrets file or private CV data.

## Verification

Executed from the dedicated worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-core.ps1
```

Final isolated real smoke: **PASS**, including the unchanged PASS marker consumed by CI. Actual PostgreSQL 17, Spring Boot Backend, FastAPI AI and Student V3 endpoint were exercised; no responses or AI output were mocked. SQL confirms exactly successful migrations 1-25, populated checksums, two persisted recommendation rows, totalJobsScanned=2 and zero PROCESSING runs. Hibernate validation completed at Backend startup.

Observed persisted values (not hardcoded recommendation responses):

| Job / tier | strategy | rankingScore | textScore | skillScore | overallScore | global / tier rank |
|---|---|---:|---:|---:|---:|---|
| English / PRIMARY | SAME_LANGUAGE_HYBRID | 0.35000 | 0.00000 | 1.00000 | 0.35000 | 1 / 1 |
| Vietnamese / FALLBACK | CROSS_LANGUAGE_SKILL_BASED | 1.00000 | null | 1.00000 | null | 2 / 1 |

A zero TF-IDF text score is valid for this unchanged persisted synthetic CV text and threshold=0; no hidden filtering or scoring change was introduced. The real PRIMARY computation preserves 0.65*text + 0.35*skill. PRIMARY precedes FALLBACK despite FALLBACK's higher numeric score. Both SQL rows match public Job IDs, strategies, scores, nullable fields and Backend-assigned ranks. Canonical FALLBACK coverage remains all four skills with no missing skills. AI logs confirm exactly one actual internal V3 request, one V3 200 response and no V2 recommendation substitution.

Focused checks passed: PowerShell parser; exact skill-array JSON serialization; workflow YAML structure; git diff --check. No full Backend/AI regression, Frontend or Playwright suite was run. Docker image construction necessarily compiles/packages Backend with tests skipped, as in the production Dockerfile; the acceptance test itself is not skipped.

Development runs are recorded separately in ignored evidence: an initial Windows CRLF Maven-wrapper build failure; the reproduced stale-fixture failure; two Windows JSON-array compatibility failures caught before recommendation generation; then the final real PASS. Every owned stack cleaned successfully. For local Linux Docker compilation only, the new worktree's Maven wrapper was normalized to its canonical Git LF bytes, then checkout restored; it has no committed diff.

Three pre-existing manual containers retain identical IDs, StartedAt values and image IDs. All pre-existing named/anonymous volumes remain. Final cleanup records zero remaining owned containers, volumes or networks; only generated image tags were removed. No Docker daemon restart/prune, unknown-resource cleanup, demo DB query/mutation or Windows shutdown occurred. Existing root changes/worktrees were preserved.

Sanitized diagnostics contain Company/Job status, ownership/deadlines, counts, score/rank rows and method/path/status summaries only. Random passwords, JWTs, keys, hashes and private CV text are never printed or committed. Artifacts/env files remain gitignored.

GitHub Core Smoke CI must be checked separately on the Draft PR's pushed commit; local PASS is not CI PASS. The PR report records the actual workflow outcome when available.
