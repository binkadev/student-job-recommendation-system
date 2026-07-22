# Backend Performance Baseline

## Status

Phase A establishes the isolated PostgreSQL environment and deterministic dataset. It does not measure latency and does not optimize production behavior.

## Audit summary

The backend uses Java 21, Spring Boot 3.5.16, Spring Data JPA/Hibernate, PostgreSQL, and Flyway V1-V12. The PostgreSQL Testcontainers integration foundation validates migrations and Hibernate mappings, but its small fixtures and non-web test context are not a performance target.

The source audit selected three database-relevant endpoints:

1. `GET /api/jobs`
2. `GET /api/companies/me/applications`
3. `GET /api/public/companies`

## Selected endpoint query risks

### `GET /api/jobs`

- Spring Data page content and count queries over jobs.
- One explicit `JobSkillRepository.findByJobIdOrderByIdAsc` call for every returned job.
- `Job.company` and `JobSkill.skill` are lazy while the response mapper reads their scalar fields.
- The list hydrates complete job entities, including text fields omitted from the response.
- Source-backed potential query count grows with page jobs, distinct companies, and distinct skills.

### `GET /api/companies/me/applications`

- Current-company lookup followed by paginated application content and count queries.
- Company ownership traverses applications to jobs and companies.
- Keyword search traverses students/users and jobs.
- Application mapper reads lazy student, student user, job, company, and optional CV metadata.
- Cover-letter text is included in list payloads.

### `GET /api/public/companies`

- Paginated company content and count queries.
- One grouped open-job count query for all companies on the page.
- No source-backed N+1 was found in this list path; it is the stable-query-count control endpoint.
- Company descriptions and addresses are included in list payloads.

## Additional source-backed N+1 risks

- Recommendation run history calls `countByRunId` inside the stream.
- Latest recommendation results dereference lazy jobs and companies and are unpaginated.
- Saved-job listing dereferences lazy jobs and companies.
- Student-skill listing dereferences lazy skills.
- Admin-company listing dereferences lazy company users while open-job counts are batched.

These findings are static source evidence. Runtime SQL counts remain unmeasured.

## Phase A dataset specification

| Table | Expected rows |
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

The seed is deterministic and uses PostgreSQL `generate_series`. It creates exactly 8 skills, 20 saved jobs, and 50 distinct applications per student; 5 skills per job; one active CV per student; and exactly 5,000 applications belonging to the known heavy company.

## Measurement methodology placeholders

No performance result is asserted during Phase A.

| Endpoint | p50 | p95 | p99 | Error rate | Throughput | Payload bytes | SQL queries/request | EXPLAIN plans |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `GET /api/jobs` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `GET /api/companies/me/applications` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `GET /api/public/companies` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Future evidence must distinguish the authenticated-user lookup from endpoint-service statements. SQL logging and Hibernate statistics must remain disabled during timed latency tests and may be enabled only for a separate bounded diagnostic pass.

## Phase A verification record

- Database identity: `student_job_recommendation_perf` as `perf_user` on host port 55432
- PostgreSQL version: `17.10 (Debian 17.10-1.pgdg13+1)`
- Flyway engine version: `11.7.2`
- Latest Flyway migration: `12`, successful; all 12 versioned migrations present
- Backend performance profile confirmed: yes; external `application-performance.yml` loaded through the start script and backend listening on port 8080
- DataSeeder absent: confirmed; `users` contained zero rows after backend startup and before the performance seed
- Hibernate validation: passed; application/JPA startup completed and authenticated repository-backed requests succeeded
- Reset and seed duration: 2.347 seconds
- Initial verification duration: 0.360 seconds inside reset-and-seed; standalone verification 0.347 seconds
- ANALYZE duration: 0.615 seconds
- Post-ANALYZE verification duration: 0.340 seconds
- Exact observed row counts: matched all expected counts in the Phase A dataset table
- Safety evidence: the guard passed on the performance database and rejected database `postgres` before any reset or insert
- Login evidence: student, heavy-company, and admin accounts all authenticated with the documented local-only password and expected roles
- Warnings/failures: Docker Desktop was initially stopped and the machine blocks unsigned PowerShell scripts; Docker was started and scripts were invoked with process-local `-ExecutionPolicy Bypass`. No schema, seed, verification, or analyze failure remains.

## Scope statement

This branch does not optimize queries, add indexes, introduce caching, change API contracts, or alter production Java code. Phase B should add measurement workloads and evidence collection only after Phase A is reproducibly verified.
