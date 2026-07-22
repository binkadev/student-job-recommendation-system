# Backend Performance Baseline Environment

## Purpose and warning

This directory contains the isolated, deterministic PostgreSQL environment for the Student Job Recommendation System backend performance baseline.

**Local performance testing only. Never point these scripts at development, test, staging, or production databases.** The SQL guard requires the exact database `student_job_recommendation_perf` and exact database user `perf_user` before it permits reset or seed operations.

Phase A creates the environment and dataset. Phase B1 adds measurement tooling and runs only bounded correctness validation. Phase B2 has now produced and finalized three valid 10-VU × 10,000-request runs per endpoint under `performance/results/baseline/20260722-203311-680bd870-native/`.

No phase in this branch optimizes production queries, adds application indexes, changes API contracts, or introduces caching. The Phase B2 numbers are an observed comparison baseline, not a latency SLA or capacity limit.

## Architecture

```text
Spring Boot backend (performance profile, port 8080)
       |
       | JDBC localhost:55432
       v
PostgreSQL 17 container
  database: student_job_recommendation_perf
  user:     perf_user
  volume:   student-job-recommendation-perf-data
```

The normal root `docker-compose.yml`, development database on port 5432, and development volume are not used.

The backend remains the schema owner:

1. The performance PostgreSQL container starts empty.
2. The backend starts with the external `performance` profile.
3. Existing Flyway migrations V1-V12 are applied from `backend/src/main/resources/db/migration`.
4. Hibernate validates the migrated mappings.
5. The standalone performance SQL scripts reset and seed application data.

Migration SQL is not copied into this directory.

## Exact database identity

| Setting | Required value |
|---|---|
| PostgreSQL image | `postgres:17` |
| Host | `localhost` |
| Host port | `55432` |
| Container port | `5432` |
| Database | `student_job_recommendation_perf` |
| User | `perf_user` |
| Compose project | `student-job-recommendation-perf` |
| Named volume | `student-job-recommendation-perf-data` |

## Prerequisites

- Docker Desktop or another Docker engine with Compose v2.
- Java 21.
- The Maven wrapper committed under `backend/`.
- Host ports 55432 and 8080 available.

Check Docker before setup:

```powershell
docker version
docker compose version
```

## First-time setup

From the repository root:

```powershell
Copy-Item performance/.env.example performance/.env
```

`performance/.env` is ignored by the repository's existing `**/.env` rule. Keep it local. It must contain only local performance values; never copy personal or production credentials into it.

Validate and start PostgreSQL:

```powershell
docker compose --env-file performance/.env -f performance/docker-compose.yml config
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\start-db.ps1
```

## Two-terminal workflow

### Terminal 1: start and keep the backend running

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\start-backend.ps1
```

The script safely loads `performance/.env` and sets:

```text
SPRING_PROFILES_ACTIVE=performance
SPRING_CONFIG_ADDITIONAL_LOCATION=file:<absolute-repository-path>/performance/config/
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:55432/student_job_recommendation_perf
SPRING_DATASOURCE_USERNAME=perf_user
```

Spring therefore loads `performance/config/application-performance.yml` as an external profile file. That configuration uses `ddl-auto=validate`, enables Flyway, disables OSIV, SQL output, SQL initialization, and Hibernate statistics by default.

The existing `DataSeeder` is annotated `@Profile("dev")`. Because only `performance` is active, it does not execute.

Wait for the backend log to confirm:

- Profile `performance` is active.
- Flyway has applied or validated migration V12.
- Hibernate EntityManagerFactory initialization completed.
- Tomcat started on the expected local port.
- No demo users such as `admin@example.com` were inserted.

### Terminal 2: reset, seed, and verify

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\reset-and-seed.ps1
```

The command executes the safety guard, resets application rows, loads the deterministic dataset, and runs every invariant check. It stops on the first SQL error.

Keep Terminal 1 running after seeding so the backend is ready for the later measurement phase.

## Local-only performance logins

All three accounts use the deliberately non-production password:

```text
PerfLocalOnly2026
```

| Purpose | Email | Role |
|---|---|---|
| Jobs endpoint | `perf.student.0001@example.test` | STUDENT |
| Heavy-company applications | `perf.company.001@example.test` | COMPANY |
| Optional diagnostics | `perf.admin@example.test` | ADMIN |

The seed contains a Spring Security-compatible BCrypt strength-10 hash. Authentication still enforces the existing `ACTIVE` status and lower-cased email lookup.

Do not reuse this password or these hashes outside the disposable local performance database.

## Dataset operations

Reset, seed, and verify:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\reset-and-seed.ps1
```

Verification only:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\verify-dataset.ps1
```

Update PostgreSQL planner statistics:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\analyze-dataset.ps1
```

Verify again after `ANALYZE`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\verify-dataset.ps1
```

## Phase B1 measurement tooling

> **Phase B1 evidence is tooling validation, not the final performance baseline.** Never copy smoke latency or throughput into official baseline fields. The finalized Phase B2 result is documented separately below and uses only the full 10,000-request summaries in `run-1`, `run-2`, and `run-3` for latency aggregation.

The canonical requests are:

| Workload | Request | Authentication |
|---|---|---|
| Jobs | `GET /api/jobs?page=1&size=20` | student |
| Company applications | `GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc` | heavy company |
| Public companies | `GET /api/public/companies?page=1&size=20&sort=createdAt,desc` | none |

Login uses `POST /api/auth/login`. Authenticated k6 scripts perform login once in `setup()` and tag setup traffic as `measured=false`; latency/error/throughput evidence uses the `measured=true` submetrics. Tokens remain in memory and are not written to results. The public-company script never creates an `Authorization` header.

Set the documented local-only password in the current PowerShell process without placing it in a command history, result file, or committed environment file:

```powershell
$env:PERFORMANCE_PASSWORD = Read-Host 'Performance-only password'
```

Optional variables are:

```text
BASE_URL
VUS
ITERATIONS
RESULT_DIRECTORY
STUDENT_EMAIL
COMPANY_EMAIL
PERFORMANCE_PASSWORD
```

Defaults for the student and company emails are the deterministic accounts listed above. `BASE_URL` defaults to `http://localhost:8080`.

### Smoke correctness validation

Run exactly 1 VU and 5 iterations per endpoint:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\run-k6-smoke.ps1
```

The smoke launcher intentionally ignores `VUS` and `ITERATIONS` and fixes them at `1` and `5`. It checks HTTP 200, valid JSON, the `ApiResponse` envelope, page fields, non-empty content, and absence of authentication errors. A failed check, HTTP error, or dropped iteration causes a non-zero exit.

### Local and Dockerized k6

If `k6` is available on `PATH`, the launchers use it. Otherwise they run the official `grafana/k6:latest` image. Force the Docker path for validation with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\run-k6-smoke.ps1 -ForceDocker
```

For Dockerized k6, a host URL using `localhost` or `127.0.0.1` is translated inside the container to:

```text
http://host.docker.internal:8080
```

The baseline launcher is the Phase B2 workload driver and must not be used for a Phase B1 smoke validation:

```powershell
# PHASE B2 ONLY; do not run as part of tooling validation.
$env:VUS = '10'
$env:ITERATIONS = '10000'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\run-k6-baseline.ps1
```

### Query-count procedure

`pg_stat_statements` is preloaded only by `performance/docker-compose.yml`. After first adding the Phase B1 configuration, recreate the isolated container while preserving its named volume:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\start-db.ps1
```

The guarded `performance/sql/50_enable_pg_stat_statements.sql` creates the extension only when the database is exactly `student_job_recommendation_perf`, the user is `perf_user`, Flyway V12 is present, and the preload library is active.

Stop all k6 runs, then capture one endpoint request at a time:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\measure-query-count.ps1
```

The script logs in before each statistics reset, confirms there is no active SQL workload, resets statistics, issues exactly one canonical GET, and captures normalized SQL, calls, rows, execution time, and shared block hits/reads. Instrumentation SQL is excluded. For authenticated endpoints, an email-based JWT user lookup is classified separately when PostgreSQL's normalized statement permits it; transaction-control calls and endpoint-service SQL are also reported separately.

Never run query-count diagnostics concurrently with k6. The query-count path is restricted to the local backend on port 8080 and the database guard rejects any non-performance database identity.

### EXPLAIN procedure

Stop k6 and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\capture-explain-plans.ps1
```

Each endpoint SQL file mirrors its repository content query, count query, and an important secondary query. Every plan runs inside `BEGIN READ ONLY`, applies a local 30-second statement timeout, uses `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)`, and ends with `ROLLBACK`. Deterministic IDs come from the seeded page.

### Result directories

By default each launcher creates a timestamp/SHA run root. To put smoke, query counts, and plans in one run, reuse `RESULT_DIRECTORY`:

```text
performance/results/baseline/<timestamp>-<git-sha>/
  metadata.json
  metadata.md
  smoke/
  query-count/
  explain/
  k6/
```

Generated run directories are ignored by `performance/.gitignore`. Passwords, JWTs, environment files, and binary output must never be stored. Small reviewed JSON/text/Markdown evidence may be force-added later only after a secret audit.

Metadata collection can also be run directly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\collect-environment-metadata.ps1
```

It records the Git state, Java/Spring/PostgreSQL/Flyway/Docker/k6 versions, OS/CPU/RAM, guarded database identity and row counts, timestamp, and canonical endpoint parameters. It does not collect a host name, operating-system user, password, JDBC secret, or token.

## Phase B2 finalized baseline

The valid baseline directory is:

```text
performance/results/baseline/20260722-203311-680bd870-native/
```

Validation selected only `run-1`, `run-2`, and `run-3`. Every run contains all three endpoints at 10 VUs and exactly 10,000 measured requests, with zero HTTP failures, zero failed checks, and zero dropped iterations. `preflight/`, `smoke/`, and the single-request `diagnostics/` directory are excluded from latency aggregation.

| Endpoint | Median p50 | Median p95 | Median p99 | Median throughput | SQL calls / service calls | Result |
|---|---:|---:|---:|---:|---:|---|
| Jobs | 71.7433 ms | 81.305875 ms | 88.773907 ms | 117.73193731746802 req/s | 66 / 63 | VALID BASELINE |
| Company applications | 53.88745 ms | 63.21743999999998 ms | 70.22372 ms | 160.2860518737853 req/s | 53 / 50 | VALID BASELINE |
| Public companies | 7.060499999999999 ms | 8.6116 ms | 9.596142 ms | 700.343657932604 req/s | 4 / 3 | VALID BASELINE |

The official analysis is in `docs/backend-performance-baseline.md`. Within the result directory:

- `baseline-summary.json` contains structured source-precision numbers.
- `baseline-summary.md` is the human-readable evidence summary.
- `evidence-manifest.md` records artifact selection, exclusions, provenance limitations, and raw SHA-256 hashes.

The isolated query counts verify ORM query fan-out in Jobs and Company applications, but do not show individually expensive point queries. All nine EXPLAIN plans are buffer-resident and spill-free; the maximum observed SQL execution time is 4.528 ms. Public companies remains the fixed-query control.

Raw run metadata and diagnostics retain the measurement collector's stale Phase B1 `phase` label. They were not rewritten. Phase B2 identity comes from the explicit three-run layout and exact 10-VU × 10,000-request summaries. See the evidence manifest for the provenance note.

Do not rerun these 10,000-request workloads merely to read or validate the finalized baseline. Use the smoke launcher for tooling correctness and reproduce Phase B2 only when intentionally establishing a new comparable baseline.

## Expected row counts

| Table | Rows |
|---|---:|
| `users` | 1,101 |
| `students` | 1,000 |
| `student_profiles` | 1,000 |
| `companies` | 100 |
| `skills` | 250 |
| `student_skills` | 8,000 |
| `jobs` | 10,000 |
| `job_skills` | 50,000 |
| `saved_jobs` | 20,000 |
| `cv_files` | 1,200 |
| `applications` | 50,000 |
| `recommendation_runs` | 0 |
| `recommendation_results` | 0 |
| `notifications` | 0 |

Important deterministic distributions:

- Companies: 80 `VERIFIED`, 10 `PENDING`, 10 `BLOCKED`.
- Jobs: 7,000 `ACTIVE`, 1,000 `DRAFT`, 500 `PENDING_APPROVAL`, 1,000 `CLOSED`, 300 `REJECTED`, 200 `EXPIRED`.
- Exactly 8 skills per student and 5 skills per job.
- Exactly 20 saved jobs and 50 applications per student.
- Exactly 40,000 applications reference a CV belonging to the same student.
- Company ID 1 owns exactly 5,000 applications and is represented by `perf.company.001@example.test`.

## Safety guarantees

- Server-side SQL checks run before every reset, seed, verification, and analyze operation.
- The database must be exactly `student_job_recommendation_perf`.
- The database user must be exactly `perf_user`.
- Successful Flyway V12 and all required application tables must exist.
- Reset preserves `flyway_schema_history` and all schema objects.
- Seed refuses to run unless application tables are empty.
- Scripts never address port 5432 or the normal development Compose project.
- SQL files are mounted read-only into the PostgreSQL container.
- No script is bound to application startup, Maven test phases, integration tests, or GitHub Actions.

## Cleanup

Stop the container while preserving its volume:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\stop-db.ps1
```

Delete the disposable performance volume as well:

```powershell
docker compose --env-file performance/.env -f performance/docker-compose.yml down --volumes
```

The latter command irreversibly removes only the dedicated performance volume named in `performance/.env`.

## Troubleshooting

### Missing `.env`

Run:

```powershell
Copy-Item performance/.env.example performance/.env
```

### Port 55432 already in use

Stop the conflicting process. Do not change the port to 5432; the scripts intentionally require 55432.

### Guard reports missing Flyway history or tables

Start the backend in Terminal 1 and wait for Flyway and Hibernate initialization before seeding.

### Guard reports the wrong database or user

Stop immediately. Check `performance/.env` and ensure only the dedicated performance Compose project is running.

### Backend starts with `dev`

Stop it. Use only `performance/scripts/start-backend.ps1`, which forces `SPRING_PROFILES_ACTIVE=performance`.

### Existing volume has incompatible credentials or schema

Delete only the dedicated performance volume, restart PostgreSQL, start the backend to apply Flyway V1-V12, and seed again.

### SQL script stops during seed

No subsequent SQL step runs because psql uses `ON_ERROR_STOP`. Rerun `reset-and-seed.ps1`; the reset makes recreation deterministic.
