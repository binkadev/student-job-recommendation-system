# Optimized Branch Environment Metadata

> End-to-end HTTP remeasurement against the deterministic isolated performance dataset.

- Test timestamp (UTC): `2026-07-25T13:58:08.7609932Z`
- Git SHA: `de5127a0ada0e02d78eb970c0e51c3aa8ce2cfe4`
- Git branch: `perf/remove-query-fanout`
- Working tree: `dirty`
- Java: `openjdk version "21.0.11" 2026-04-21 LTS OpenJDK Runtime Environment Microsoft-13877171 (build 21.0.11+10-LTS) OpenJDK 64-Bit Server VM Microsoft-13877171 (build 21.0.11+10-LTS, mixed mode, sharing)`
- Spring Boot: `3.5.16`
- PostgreSQL: `17.10 (Debian 17.10-1.pgdg13+1)`
- Latest Flyway migration: `14`
- Docker: `client=29.5.3; server=29.5.3`
- Docker Compose: `5.1.4`
- k6: `k6.exe v2.1.0 (commit/83a87a41e2, go1.26.4, windows/amd64)`
- k6 runner: `native`
- k6 Docker image: `not used`
- Operating system: `Microsoft Windows 11 Home 10.0.26200`
- CPU: `12th Gen Intel(R) Core(TM) i7-12700H`
- Logical CPUs: `20`
- Total RAM bytes: `34070847488`
- Database: `student_job_recommendation_perf`
- Database user: `perf_user`
- Base URL: `http://localhost:8080`

## Database row counts

| Table | Rows |
|---|---:|
| `jobs` | 10000 |
| `users` | 1101 |
| `skills` | 250 |
| `cv_files` | 1200 |
| `students` | 1000 |
| `companies` | 100 |
| `job_skills` | 50000 |
| `saved_jobs` | 20000 |
| `applications` | 50000 |
| `notifications` | 0 |
| `saved_searches` | 0 |
| `student_skills` | 8000 |
| `saved_candidates` | 0 |
| `student_profiles` | 1000 |
| `recommendation_runs` | 20 |
| `recommendation_results` | 40 |
| `user_notification_settings` | 0 |

## Selected requests

| Workload | Request | Authentication |
|---|---|---|
| jobs-list | `GET /api/jobs?page=1&size=20` | STUDENT |
| company-applications | `GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc` | COMPANY |
| public-companies | `GET /api/public/companies?page=1&size=20&sort=createdAt,desc` | none |
| saved-jobs | `GET /api/students/me/saved-jobs?page=1&size=20` | STUDENT |
| recommendation-runs | `GET /api/students/me/recommendation-runs` | STUDENT |

Latency, throughput, correctness, and query-count evidence are stored alongside this manifest.
