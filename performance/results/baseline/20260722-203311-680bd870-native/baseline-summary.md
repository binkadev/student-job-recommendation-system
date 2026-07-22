# Official Phase B2 Baseline Summary

Status: **READY — VALID BASELINE**

This summary finalizes the three valid Phase B2 runs in this directory. It does not use latency from `preflight/`, `smoke/`, or `diagnostics/`, and it does not define a latency SLA.

## Evidence identity

| Item | Value |
|---|---|
| Branch | `perf/api-db-baseline` |
| Git SHA | `680bd8709b3044a2710e2f5f5fcc067878086ee1` |
| Valid runs | `run-1`, `run-2`, `run-3` |
| Database | `student_job_recommendation_perf` as `perf_user` |
| PostgreSQL | 17.10 |
| Flyway | V12 |
| Dataset | 142,651 rows; identical table counts in all three run metadata files |
| Workload | 10 VUs, exactly 10,000 measured iterations per endpoint per run |

All nine endpoint/run combinations report 10,000 measured requests, zero HTTP failures, zero failed checks, and zero dropped iterations. The authenticated workloads each contain one additional unmeasured setup login request; setup traffic is excluded from the measured latency, error-rate, throughput, request-count, and response-byte metrics.

## Raw three-run results

The following values are copied from the higher-precision k6 summary JSON. Durations are complete k6 scenario durations, including scenario orchestration, while throughput is the measured-request rate.

### `GET /api/jobs?page=1&size=20`

| Run | Requests | p50 ms | p95 ms | p99 ms | Throughput req/s | HTTP error rate | Failed checks | Dropped iterations | Avg body bytes | Duration ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| run-1 | 10000 | 70.90809999999999 | 80.74298499999999 | 88.773907 | 118.42084037780425 | 0 | 0 | 0 | 23897 | 84444.5958 |
| run-2 | 10000 | 71.7433 | 81.305875 | 87.065861 | 117.73193731746802 | 0 | 0 | 0 | 23897 | 84938.7195 |
| run-3 | 10000 | 71.9569 | 82.79065 | 96.28312700000001 | 116.36447493258851 | 0 | 0 | 0 | 23897 | 85936.8807 |

### `GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc`

| Run | Requests | p50 ms | p95 ms | p99 ms | Throughput req/s | HTTP error rate | Failed checks | Dropped iterations | Avg body bytes | Duration ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| run-1 | 10000 | 53.41335 | 63.21743999999998 | 70.22372 | 160.99330214252316 | 0 | 0 | 0 | 15203 | 62114.3853 |
| run-2 | 10000 | 53.88745 | 62.49875 | 69.66366400000001 | 160.2860518737853 | 0 | 0 | 0 | 15203 | 62388.4604 |
| run-3 | 10000 | 54.941 | 63.77161 | 71.215569 | 157.67214534852832 | 0 | 0 | 0 | 15203 | 63422.7433 |

### `GET /api/public/companies?page=1&size=20&sort=createdAt,desc`

| Run | Requests | p50 ms | p95 ms | p99 ms | Throughput req/s | HTTP error rate | Failed checks | Dropped iterations | Avg body bytes | Duration ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| run-1 | 10000 | 7.0753 | 8.6116 | 9.763448000000006 | 700.343657932604 | 0 | 0 | 0 | 9094 | 14278.7043 |
| run-2 | 10000 | 6.985 | 8.356909999999997 | 9.596142 | 714.7375202933638 | 0 | 0 | 0 | 9094 | 13991.1502 |
| run-3 | 10000 | 7.060499999999999 | 8.619224999999998 | 9.439100000000002 | 697.6112020509323 | 0 | 0 | 0 | 9094 | 14334.6322 |

## Official median baseline

Medians were calculated from the source numeric values above before display rounding.

| Endpoint | Median p50 ms | Median p95 ms | Median p99 ms | Median throughput req/s | SQL calls/request | Service SQL calls | Average response bytes | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Jobs | 71.7433 | 81.305875 | 88.773907 | 117.73193731746802 | 66 | 63 | 23897 | VALID BASELINE |
| Company applications | 53.88745 | 63.21743999999998 | 70.22372 | 160.2860518737853 | 53 | 50 | 15203 | VALID BASELINE |
| Public companies | 7.060499999999999 | 8.6116 | 9.596142 | 700.343657932604 | 4 | 3 | 9094 | VALID BASELINE |

## Query-count diagnosis

The one-request `pg_stat_statements` captures ran serially and outside the timed k6 workloads.

| Endpoint | Total calls | JWT lookup | Transaction control | Service calls | Normalized groups | Rows | DB execution ms | Shared hits | Shared reads | Classification |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Jobs | 66 | 1 | 2 | 63 | 7 | 163 | 7.060 | 1503 | 0 | VERIFIED QUERY FAN-OUT |
| Company applications | 53 | 1 | 2 | 50 | 9 | 70 | 4.536 | 9078 | 0 | VERIFIED QUERY FAN-OUT |
| Public companies | 4 | 0 | 1 | 3 | 4 | 41 | 0.526 | 157 | 0 | ACCEPTABLE BASELINE BEHAVIOR |

`rows` is the aggregate `pg_stat_statements.rows` value returned or affected by statements, not the number of rows examined internally.

- Jobs: content and count use two service calls. Mapping the 20 returned jobs then issues 20 job-skill calls, 30 distinct lazy skill calls, and 11 distinct lazy company calls: 61 fan-out calls. Those 61 calls total approximately 1.660 ms of PostgreSQL execution, so the verified issue is call multiplicity rather than individually expensive SQL.
- Company applications: content, count, and current-company lookup use three service calls. Mapping issues 18 student, 18 user, 9 job, and 2 CV calls: 47 fan-out calls totaling approximately 0.795 ms. Again, the evidence verifies fan-out, not slow point queries.
- Public companies: one content, one count, and one batched open-job aggregate produce a fixed three-service-query shape. No authentication lookup is present.
- JWT lookup overhead is one call and 0.166 ms for Jobs, one call and 0.056 ms for Company applications, and absent for Public companies. Transaction-control execution is 0.097 ms, 0.033 ms, and 0.036 ms respectively. Both are acceptable baseline overhead here.

## EXPLAIN diagnosis

All nine plans completed read-only with zero shared reads, zero temp reads/writes, and no sort spill. The maximum single-query execution time was 4.528 ms.

| Endpoint/query | Root | Scans and indexes | Estimate vs actual | Loops | Sort | Buffers hit/read | Plan/execute ms | Filtered | Classification |
|---|---|---|---|---:|---|---:|---:|---:|---|
| Jobs content | Limit | Seq Scan | jobs 7000/7000 | 1 | top-N heapsort, 66 kB, no spill | 718/0 | 0.334/4.528 | 3000 | ACCEPTABLE BASELINE BEHAVIOR; POSSIBLE FUTURE RISK |
| Jobs count | Aggregate | Seq Scan | jobs 7000/7000 | 1 | none | 715/0 | 0.193/2.882 | 3000 | ACCEPTABLE BASELINE BEHAVIOR; POSSIBLE FUTURE RISK |
| Jobs secondary | Sort | Index Only `jobs_pkey`; Bitmap Heap/Index `uk_job_skills_job_skill` | 5/5 | 1 | quicksort, 25 kB, no spill | 16/0 | 0.277/0.133 | 0 | VERIFIED QUERY FAN-OUT |
| Applications content | Limit | Index Scan `idx_jobs_company_id`; Index Scan `idx_applications_job_id` | join 500/5000; inner 7/50 per loop | 100 inner | top-N heapsort, 46 kB, no spill | 4468/0 | 0.648/3.828 | 0 | POSSIBLE FUTURE RISK |
| Applications count | Aggregate | Index Scan `idx_jobs_company_id`; Index Scan `idx_applications_job_id` | join 500/5000; inner 7/50 per loop | 100 inner | none | 4462/0 | 0.178/1.671 | 0 | POSSIBLE FUTURE RISK |
| Applications secondary | Index Scan | `jobs_pkey` | 1/1 | 1 | none | 3/0 | 0.091/0.009 | 0 | VERIFIED QUERY FAN-OUT |
| Public content | Limit | Seq Scan | companies 80/80 | 1 | top-N heapsort, 45 kB, no spill | 8/0 | 0.241/0.074 | 20 | ACCEPTABLE BASELINE BEHAVIOR |
| Public count | Aggregate | Seq Scan | companies 80/80 | 1 | none | 5/0 | 0.045/0.032 | 20 | ACCEPTABLE BASELINE BEHAVIOR |
| Public secondary | Aggregate | Index Scan `idx_jobs_company_id` | groups 100/20; scan 1400/1400 | 1 | none; index supplies grouping order | 147/0 | 0.193/0.512 | 600 | ACCEPTABLE BASELINE BEHAVIOR |

The material cardinality error is the applications join estimate: 500 planned rows versus 5,000 actual rows (10×), driven by 7 planned versus 50 actual application rows per each of 100 job loops (about 7.14×). It did not cause a spill or a slow query in this dataset, so it is a future-growth risk rather than a verified current bottleneck. The public secondary aggregate estimates 100 groups versus 20 actual groups (5×), but the plan remains sub-millisecond and buffer-local. The limited Sort nodes' 20 returned rows are demand-limited by the parent Limit and are not cardinality-estimation errors.

## Prioritized findings

1. **Jobs query fan-out — highest value.** Source and runtime evidence agree on 61 mapping-related calls. Batch the page's companies and job-skill/skill data without collection-fetch-joining a pageable query. Trade-off: repository and response-assembly complexity. Compare service calls (63 toward approximately 3), total calls (66 toward approximately 6), official median p50/p95/p99, throughput, DB execution/hits, correctness, and the unchanged 23,897-byte response.
2. **Company-applications query fan-out.** Source and runtime evidence agree on 47 mapping-related calls. Consider a bounded DTO projection or to-one fetch strategy while retaining a separate count. Trade-off: a wider content row and careful pageable/count semantics. Compare service calls (50 toward approximately 3), total calls (53 toward approximately 6), median latency/throughput, DB execution/hits, and unchanged response semantics/size.
3. **List entity over-fetch — possible future risk.** Jobs content hydrates wide entity text columns that the list response does not require; lazy application dependencies also hydrate complete rows. Consider purpose-built projections only after fan-out is fixed. Compare SQL plan width, JDBC bytes, JVM allocation/GC, response bytes, and official latency.
4. **Applications estimate and buffer growth — possible future risk.** The current plan is fast but underestimates the join by 10× and touches more than 4,400 shared buffers in each content/count query. Re-test with larger and skewed company distributions after fan-out work. Compare estimate/actual ratios, loops, hits/reads, temp I/O, query execution, and endpoint tails.
5. **Jobs scan/count/sort growth — possible future risk, acceptable today.** Sequential scans are rational at 7,000 qualifying rows out of 10,000, remain buffer-local, and execute in 4.528/2.882 ms. Do not infer an index requirement from scan type alone. Compare at materially larger datasets before acting.
6. **Public companies — control endpoint.** Three fixed service queries, sub-millisecond plans, and stable high throughput are acceptable. Preserve it as a regression control rather than optimize it first.

## Limitations

- This is one host, one deterministic dataset, one concurrency level, one page, and one parameter set; it is not an SLA or capacity limit.
- All plans and query-count captures were warm/buffer-resident (`shared_blks_read = 0`). Cold-cache behavior is unmeasured.
- `pg_stat_statements` measures PostgreSQL execution, not network, ORM hydration, mapping, JSON serialization, JVM allocation, or client scheduling.
- Search parameters were not exercised, so wildcard-search behavior is **NOT ENOUGH EVIDENCE**.
- Raw run metadata and diagnostic files retain the collector's Phase B1 tooling-validation `phase` label. Phase B2 identity is established by the explicit `run-1`/`run-2`/`run-3` structure and the exact 10-VU × 10,000-measured-request evidence; diagnostics are supporting evidence only. Raw evidence was not changed.
- Dataset consistency is established by identical deterministic per-table row counts, not a content checksum. Database consistency is established by logical database name, user, and PostgreSQL version, not a physical cluster fingerprint.
- No observed SLA was invented and no causal payload-size conclusion is made from response byte counts alone.

See `baseline-summary.json` for structured source-precision values and `evidence-manifest.md` for artifact selection and hashes.
