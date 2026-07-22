# Backend Performance Baseline Environment

## Purpose and warning

This directory contains the isolated, deterministic PostgreSQL environment for the Student Job Recommendation System backend performance baseline.

**Local performance testing only. Never point these scripts at development, test, staging, or production databases.** The SQL guard requires the exact database `student_job_recommendation_perf` and exact database user `perf_user` before it permits reset or seed operations.

Phase A creates the environment and dataset only. It does not optimize production queries, add indexes, change API contracts, or run k6.

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
