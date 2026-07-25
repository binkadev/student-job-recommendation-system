# Optimized HTTP Performance Remeasurement

- Git SHA: `de5127a0ada0e02d78eb970c0e51c3aa8ce2cfe4`
- Branch: `perf/remove-query-fanout`
- Dataset: 1,000 students; 100 companies; 10,000 jobs; 50,000 applications; 20,000 saved jobs; 20 recommendation runs; 40 recommendation results
- Load: 3 independent runs, 10 VUs, 10,000 measured requests per endpoint and run
- Warm-up: 1 VU × 20 requests per endpoint before each measured phase
- SQL isolation: `pg_stat_statements_reset()` after warm-up and immediately before measured requests
- Correctness: all after values below come from captured evidence; no baseline evidence was overwritten

## Before/after

| Endpoint | SQL before | HTTP SQL after | p50 before | p50 after | p95 before | p95 after | p99 before | p99 after | throughput before | throughput after |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `GET /api/jobs?page=1&size=20` | 66 (HTTP) | 6 | 71.743 ms | 20.325 ms | 81.306 ms | 28.3 ms | 88.774 ms | 37.759 ms | 117.732 req/s | 238.628 req/s |
| `GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc` | 53 (HTTP V12 baseline) | 6 | 53.887 ms | 26.499 ms | 63.217 ms | 34.526 ms | 70.224 ms | 44.925 ms | 160.286 req/s | 257.492 req/s |
| `GET /api/public/companies?page=1&size=20&sort=createdAt,desc` | 4 (HTTP) | 4 | 7.061 ms | 8.519 ms | 8.612 ms | 11.858 ms | 9.596 ms | 14.286 ms | 700.344 req/s | 590.274 req/s |
| `GET /api/students/me/saved-jobs?page=1&size=20` | n/a (integration-test service evidence) | 6 | n/a | 10.853 ms | n/a | 14.387 ms | n/a | 16.778 ms | n/a | 661.502 req/s |
| `GET /api/students/me/recommendation-runs` | n/a (N + 2 service formula at N=20) | 6 | n/a | 10.254 ms | n/a | 13.034 ms | n/a | 15.265 ms | n/a | 690.484 req/s |

Saved-jobs before SQL is service-level integration evidence (20 items = 27 statements), not an old HTTP capture. Recommendation-runs before is the service formula `N + 2` (22 statements at 20 runs). The Company-applications V12 baseline recorded 53 HTTP SQL calls, but its EntityGraph predated this performance branch, so the current reduction is not attributed solely to this branch.

## Three independent measured runs

| Endpoint | Run | Requests | p50 ms | p95 ms | p99 ms | req/s | HTTP failure rate | Failed checks | Dropped | Load SQL/request |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| jobs-list | run-01 | 10000 | 21.851 | 34.243 | 45.035 | 227.297 | 0 | 0 | 0 | 6.001 |
| jobs-list | run-02 | 10000 | 20.098 | 26.505 | 34.968 | 243.351 | 0 | 0 | 0 | 6 |
| jobs-list | run-03 | 10000 | 20.325 | 28.3 | 37.759 | 238.628 | 0 | 0 | 0 | 6 |
| company-applications | run-01 | 10000 | 25.855 | 34.526 | 45.642 | 261.483 | 0 | 0 | 0 | 6 |
| company-applications | run-02 | 10000 | 26.499 | 36.532 | 44.925 | 256.018 | 0 | 0 | 0 | 6 |
| company-applications | run-03 | 10000 | 26.605 | 33.464 | 43.346 | 257.492 | 0 | 0 | 0 | 6 |
| public-companies | run-01 | 10000 | 8.519 | 12.04 | 14.609 | 590.274 | 0 | 0 | 0 | 4 |
| public-companies | run-02 | 10000 | 8.214 | 11.337 | 13.434 | 611.528 | 0 | 0 | 0 | 4 |
| public-companies | run-03 | 10000 | 8.643 | 11.858 | 14.286 | 588.957 | 0 | 0 | 0 | 4 |
| saved-jobs | run-01 | 10000 | 10.853 | 14.387 | 16.778 | 661.502 | 0 | 0 | 0 | 6 |
| saved-jobs | run-02 | 10000 | 10.787 | 13.93 | 16.073 | 671.815 | 0 | 0 | 0 | 6 |
| saved-jobs | run-03 | 10000 | 11.158 | 14.536 | 17.032 | 644.113 | 0 | 0 | 0 | 6 |
| recommendation-runs | run-01 | 10000 | 10.254 | 13.034 | 15.201 | 690.484 | 0 | 0 | 0 | 6 |
| recommendation-runs | run-02 | 10000 | 10.589 | 13.956 | 16.724 | 666.913 | 0 | 0 | 0 | 6 |
| recommendation-runs | run-03 | 10000 | 9.86 | 12.738 | 15.265 | 717.146 | 0 | 0 | 0 | 6 |

## Query shapes

### jobs-list

- Before: JWT lookup + pageable job content/count + per-item job-skill, skill, and company fan-out.
- After: JWT lookup + pageable content with company + count + one batched job-skill/skill query.
- Isolated HTTP SQL: total `6`, JWT/security `1`, transaction control `2`, service `3`.
### company-applications

- Before: Historical V12 HTTP capture with application mapping fan-out.
- After: JWT lookup + company ownership lookup + pageable EntityGraph content + count.
- Isolated HTTP SQL: total `6`, JWT/security `1`, transaction control `2`, service `3`.
### public-companies

- Before: Public pageable company content/count + grouped open-job counts.
- After: Unchanged public pageable company content/count + grouped open-job counts.
- Isolated HTTP SQL: total `4`, JWT/security `0`, transaction control `1`, service `3`.
### saved-jobs

- Before: Student lookup + pageable content/count + lazy job/company fan-out.
- After: JWT lookup + student lookup + pageable EntityGraph content with job/company + count.
- Isolated HTTP SQL: total `6`, JWT/security `1`, transaction control `2`, service `3`.
### recommendation-runs

- Before: Student lookup + run list + one COUNT per run (N + 2).
- After: JWT lookup + student lookup + ordered run list + one grouped result-count aggregate.
- Isolated HTTP SQL: total `6`, JWT/security `1`, transaction control `2`, service `3`.

## EXPLAIN summary

| Plan | Root node | Rows | Planning ms | Execution ms | Shared hits | Shared reads |
|---|---|---:|---:|---:|---:|---:|
| 20260725-135843629-company-applications-content.json | Limit | 20 | 1.691 | 7.299 | 4580 | 0 |
| 20260725-135843629-company-applications-count.json | Aggregate | 1 | 0.159 | 1.589 | 4462 | 0 |
| 20260725-135843629-company-applications-secondary.json | Seq Scan | 1 | 0.057 | 0.048 | 5 | 0 |
| 20260725-135843629-jobs-list-content.json | Limit | 20 | 0.76 | 5.638 | 723 | 0 |
| 20260725-135843629-jobs-list-count.json | Aggregate | 1 | 0.054 | 1.816 | 715 | 0 |
| 20260725-135843629-jobs-list-secondary.json | Sort | 100 | 0.603 | 2.476 | 1058 | 0 |
| 20260725-135843629-public-companies-content.json | Limit | 20 | 0.201 | 0.086 | 8 | 0 |
| 20260725-135843629-public-companies-count.json | Aggregate | 1 | 0.044 | 0.038 | 5 | 0 |
| 20260725-135843629-public-companies-secondary.json | Aggregate | 20 | 0.208 | 0.64 | 147 | 0 |
| 20260725-135843629-recommendation-runs-content.json | Sort | 20 | 0.193 | 0.035 | 4 | 0 |
| 20260725-135843629-recommendation-runs-count.json | Aggregate | 16 | 0.41 | 0.057 | 2 | 0 |
| 20260725-135843629-recommendation-runs-secondary.json | Index Scan | 1 | 0.083 | 0.028 | 6 | 0 |
| 20260725-135843629-saved-jobs-content.json | Limit | 20 | 0.751 | 0.254 | 128 | 0 |
| 20260725-135843629-saved-jobs-count.json | Aggregate | 1 | 0.042 | 0.035 | 22 | 0 |
| 20260725-135843629-saved-jobs-secondary.json | Index Scan | 1 | 0.125 | 0.02 | 3 | 0 |

## Evidence

- Raw k6 summaries and normalized summaries: `run-*/k6/<endpoint>/raw-summary.json` and `summary.json`
- Per-run top PostgreSQL statements: `run-*/k6/<endpoint>/pg-stat-statements.json`
- Isolated one-request SQL classification: `query-count/*.json`
- `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)`: `explain/*.json`
- Environment and dataset manifest: `metadata.json`, `metadata.md`, `benchmark-manifest.json`
- Machine-readable consolidated result: `summary.json`
