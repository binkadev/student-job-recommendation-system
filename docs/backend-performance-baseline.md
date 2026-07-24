# Backend Performance Baseline

## 1. Executive summary

Phase B2 is **READY**. Three complete 10,000-request baseline runs are valid for all three selected endpoints. Every endpoint/run combination used 10 virtual users and exactly 10,000 measured requests, with zero HTTP failures, zero failed checks, and zero dropped iterations.

The official result is a correctness classification, not an SLA judgment. All three endpoints are **VALID BASELINE**. The strongest engineering finding is query fan-out in the two authenticated list endpoints: a single 20-item Jobs request produces 66 SQL calls, and a single Company applications request produces 53. PostgreSQL execution for the isolated requests is only 7.060 ms and 4.536 ms respectively, so the evidence supports reducing round trips and ORM mapping fan-out before considering speculative indexes. Public companies is the fixed-query control at four total SQL calls.

No production Java, API contract, Flyway migration, application index, cache, or dependency was changed during finalization.

## 2. Environment and Git SHA

| Item | Value |
|---|---|
| Branch | `perf/api-db-baseline` |
| Git SHA | `680bd8709b3044a2710e2f5f5fcc067878086ee1` |
| Run Git state | clean in all three metadata records |
| Run timestamps | 2026-07-22 13:36:11Z through 13:45:31Z |
| Java | 21.0.11 |
| Spring Boot | 3.5.16 |
| PostgreSQL | 17.10 |
| PostgreSQL image | `postgres:17.10@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d` |
| Database/user | `student_job_recommendation_perf` / `perf_user` |
| Flyway | V12 |
| k6 | 2.1.0, local Windows build |
| Dockerized k6 fallback | `grafana/k6:2.1.0@sha256:65c920dc067d5e2e00befbf982af6ad6ad0117034e8b1c65817c7975c52d4669` |
| Docker / Compose | 29.5.3 / 5.1.4 |
| Operating system | Microsoft Windows 11 Home 10.0.26200 |
| CPU | 12th Gen Intel Core i7-12700H, 20 logical CPUs |
| RAM | 34,070,847,488 bytes |
| Backend | `http://localhost:8080` |

All three run metadata files agree on the branch, SHA, logical database name, database user, PostgreSQL version, Flyway version, host/runtime facts, endpoint parameters, and deterministic per-table row counts.

## 3. Dataset size

The deterministic dataset contains 142,651 total rows.

| Table | Rows | Table | Rows |
|---|---:|---|---:|
| `users` | 1,101 | `students` | 1,000 |
| `student_profiles` | 1,000 | `companies` | 100 |
| `skills` | 250 | `student_skills` | 8,000 |
| `jobs` | 10,000 | `job_skills` | 50,000 |
| `saved_jobs` | 20,000 | `cv_files` | 1,200 |
| `applications` | 50,000 | `recommendation_runs` | 0 |
| `recommendation_results` | 0 | `notifications` | 0 |

The heavy company owns 100 jobs and 5,000 applications. Dataset equality between runs is verified by the complete deterministic row-count signature; no content checksum was captured.

## 4. Methodology

The canonical requests were:

| Workload | Request | Authentication |
|---|---|---|
| Jobs | `GET /api/jobs?page=1&size=20` | seeded student |
| Company applications | `GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc` | seeded heavy company |
| Public companies | `GET /api/public/companies?page=1&size=20&sort=createdAt,desc` | none; no `Authorization` header |

Each endpoint ran with 10 VUs and 10,000 shared measured iterations in each of three complete runs. Authenticated scripts logged in once during k6 `setup()` and retained the token in memory. Setup requests were tagged `measured=false`, so login was excluded from the measured latency, request-rate, error-rate, request-count, and response-byte submetrics. One additional unmeasured HTTP request is therefore expected in each authenticated summary.

k6 checked HTTP 200, valid JSON, the expected `ApiResponse` and page structure, non-empty content, and absence of authentication errors. Medians were calculated independently per metric from the three higher-precision source JSON numbers before display rounding. No cross-run average was used.

The following evidence was excluded from latency aggregation:

- `preflight/`: exploratory 1,000-request workloads.
- `smoke/`: five-iteration correctness workloads.
- `diagnostics/`: one-request SQL counts and read-only execution plans.
- Any timeout, partial, or failed run: none was selected.

Query-count and EXPLAIN diagnostics ran serially and outside timed k6 workloads. Reproduction tooling now enforces this with a repository-scoped atomic mutex and typed JSON leases under ignored `performance/.locks/`: k6 holds a load-test lease for its complete native or Docker lifetime, while query-count capture holds an incompatible diagnostic lease before any statistics reset. It also rejects active Grafana k6 containers and fails closed when isolation cannot be proven. `pg_stat_statements` was reset immediately before one isolated canonical HTTP request. The plan captures used repository-shaped SQL inside read-only transactions with a 30-second statement timeout.

## 5. Three-run raw results

Values below preserve the source JSON precision. Duration is the complete k6 scenario duration; throughput is the measured-request rate.

| Endpoint | Run | Measured requests | p50 ms | p95 ms | p99 ms | Throughput req/s | HTTP error rate | Failed checks | Dropped | Avg body bytes | Duration ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jobs | run-1 | 10000 | 70.90809999999999 | 80.74298499999999 | 88.773907 | 118.42084037780425 | 0 | 0 | 0 | 23897 | 84444.5958 |
| Jobs | run-2 | 10000 | 71.7433 | 81.305875 | 87.065861 | 117.73193731746802 | 0 | 0 | 0 | 23897 | 84938.7195 |
| Jobs | run-3 | 10000 | 71.9569 | 82.79065 | 96.28312700000001 | 116.36447493258851 | 0 | 0 | 0 | 23897 | 85936.8807 |
| Company applications | run-1 | 10000 | 53.41335 | 63.21743999999998 | 70.22372 | 160.99330214252316 | 0 | 0 | 0 | 15203 | 62114.3853 |
| Company applications | run-2 | 10000 | 53.88745 | 62.49875 | 69.66366400000001 | 160.2860518737853 | 0 | 0 | 0 | 15203 | 62388.4604 |
| Company applications | run-3 | 10000 | 54.941 | 63.77161 | 71.215569 | 157.67214534852832 | 0 | 0 | 0 | 15203 | 63422.7433 |
| Public companies | run-1 | 10000 | 7.0753 | 8.6116 | 9.763448000000006 | 700.343657932604 | 0 | 0 | 0 | 9094 | 14278.7043 |
| Public companies | run-2 | 10000 | 6.985 | 8.356909999999997 | 9.596142 | 714.7375202933638 | 0 | 0 | 0 | 9094 | 13991.1502 |
| Public companies | run-3 | 10000 | 7.060499999999999 | 8.619224999999998 | 9.439100000000002 | 697.6112020509323 | 0 | 0 | 0 | 9094 | 14334.6322 |

## 6. Median official baseline

| Endpoint | Median p50 | Median p95 | Median p99 | Median throughput | SQL calls/request | Service SQL calls | Average response bytes | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `GET /api/jobs?page=1&size=20` | 71.7433 ms | 81.305875 ms | 88.773907 ms | 117.73193731746802 req/s | 66 | 63 | 23897 | VALID BASELINE |
| `GET /api/companies/me/applications?page=1&size=20&sort=appliedAt,desc` | 53.88745 ms | 63.21743999999998 ms | 70.22372 ms | 160.2860518737853 req/s | 53 | 50 | 15203 | VALID BASELINE |
| `GET /api/public/companies?page=1&size=20&sort=createdAt,desc` | 7.060499999999999 ms | 8.6116 ms | 9.596142 ms | 700.343657932604 req/s | 4 | 3 | 9094 | VALID BASELINE |

`VALID BASELINE` means the evidence is complete and correct. It is not a latency grade and does not imply an observed or retrofitted SLA.

## 7. Query-count analysis

### Totals and overhead separation

| Endpoint | Total calls | JWT lookup | Transaction control | Service calls | Normalized groups | Rows | Total DB ms | Shared hits | Shared reads | Classification |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Jobs | 66 | 1 | 2 | 63 | 7 | 163 | 7.060 | 1503 | 0 | VERIFIED QUERY FAN-OUT |
| Company applications | 53 | 1 | 2 | 50 | 9 | 70 | 4.536 | 9078 | 0 | VERIFIED QUERY FAN-OUT |
| Public companies | 4 | 0 | 1 | 3 | 4 | 41 | 0.526 | 157 | 0 | ACCEPTABLE BASELINE BEHAVIOR |

The `rows` column is `pg_stat_statements.rows`, meaning rows returned or affected by statements; it is not rows examined by scan nodes.

Authentication and transaction overhead are small and separately identifiable:

| Endpoint | Class | Calls/groups | Rows | DB ms | Hits/reads | Assessment |
|---|---|---:|---:|---:|---:|---|
| Jobs | Service | 63/5 | 162 | 6.797 | 1499/0 | includes verified fan-out |
| Jobs | JWT user lookup | 1/1 | 1 | 0.166 | 4/0 | ACCEPTABLE BASELINE BEHAVIOR |
| Jobs | Transaction control | 2/1 | 0 | 0.097 | 0/0 | ACCEPTABLE BASELINE BEHAVIOR |
| Company applications | Service | 50/7 | 69 | 4.447 | 9074/0 | includes verified fan-out |
| Company applications | JWT user lookup | 1/1 | 1 | 0.056 | 4/0 | ACCEPTABLE BASELINE BEHAVIOR |
| Company applications | Transaction control | 2/1 | 0 | 0.033 | 0/0 | ACCEPTABLE BASELINE BEHAVIOR |
| Public companies | Service | 3/3 | 41 | 0.490 | 157/0 | fixed batched query shape |
| Public companies | JWT user lookup | 0/0 | 0 | 0 | 0/0 | public request, correctly absent |
| Public companies | Transaction control | 1/1 | 0 | 0.036 | 0/0 | ACCEPTABLE BASELINE BEHAVIOR |

### Jobs normalized SQL groups

| Normalized shape | Class | Calls | Rows | DB ms | Hits/reads |
|---|---|---:|---:|---:|---:|
| Jobs content by status, ordered by `created_at`, offset/limit | service | 1 | 20 | 4.302 | 592/0 |
| Job skills joined to jobs by job ID, ordered by job-skill ID | service | 20 | 100 | 0.985 | 200/0 |
| Jobs count by status | service | 1 | 1 | 0.835 | 592/0 |
| Skills by primary key | service | 30 | 30 | 0.459 | 60/0 |
| Companies by primary key | service | 11 | 11 | 0.216 | 55/0 |
| Users by email | JWT lookup | 1 | 1 | 0.166 | 4/0 |
| `BEGIN READ ONLY` | transaction control | 2 | 0 | 0.097 | 0/0 |

The 20 job-skill, 30 skill, and 11 company lookups are 61 mapping-related fan-out calls for a 20-item page. This matches the source-backed N+1 hypothesis. Those 61 calls execute in approximately 1.660 ms total, so call multiplicity is verified; individually slow point queries are not.

### Company-applications normalized SQL groups

| Normalized shape | Class | Calls | Rows | DB ms | Hits/reads |
|---|---|---:|---:|---:|---:|
| Application content joined to jobs by company, ordered by `applied_at`, offset/limit | service | 1 | 20 | 2.439 | 4462/0 |
| Application count joined to jobs by company | service | 1 | 1 | 1.174 | 4462/0 |
| Students by primary key | service | 18 | 18 | 0.391 | 54/0 |
| Users by primary key | service | 18 | 18 | 0.220 | 54/0 |
| Jobs by primary key | service | 9 | 9 | 0.131 | 27/0 |
| Users by email | JWT lookup | 1 | 1 | 0.056 | 4/0 |
| CV files by primary key | service | 2 | 2 | 0.053 | 6/0 |
| Current company joined to user by user ID | service | 1 | 1 | 0.039 | 9/0 |
| `BEGIN READ ONLY` | transaction control | 2 | 0 | 0.033 | 0/0 |

The 18 student, 18 user, 9 job, and 2 CV lookups are 47 mapping-related fan-out calls. This matches the source-backed N+1 hypothesis and totals approximately 0.795 ms of PostgreSQL execution. The content plus count queries account for 3.613 ms and 8,924 buffer hits; that is a future scale signal, not proof that either query is currently slow.

### Public-companies normalized SQL groups

| Normalized shape | Class | Calls | Rows | DB ms | Hits/reads |
|---|---|---:|---:|---:|---:|
| Open-job count grouped for the 20 page company IDs | service | 1 | 20 | 0.374 | 147/0 |
| Company content by status, ordered by `created_at`, offset/limit | service | 1 | 20 | 0.088 | 5/0 |
| `BEGIN READ ONLY` | transaction control | 1 | 0 | 0.036 | 0/0 |
| Company count by status | service | 1 | 1 | 0.028 | 5/0 |

This is the expected fixed, batched shape: three service queries, no JWT lookup, and no N+1 evidence.

## 8. EXPLAIN analysis

All captures used `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)`. Every plan has an empty `Settings` object, zero shared block reads, zero temporary block reads/writes, and no disk spill. Every observed sort remained in memory. Planning buffer hits are shown separately from execution-plan buffer hits.

| Endpoint/query | Root node | Scan types and indexes | Estimated/actual rows and loops | Sort | Exec hits/reads; planning hits | Planning ms | Execution ms | Rows removed | Classification |
|---|---|---|---|---|---:|---:|---:|---:|---|
| Jobs content | Limit | Seq Scan on jobs | scan 7000/7000, loop 1; root 20/20 | top-N heapsort, 66 kB, no spill | 718/0; 174 | 0.334 | 4.528 | 3000 | ACCEPTABLE BASELINE BEHAVIOR; POSSIBLE FUTURE RISK at growth |
| Jobs count | Aggregate | Seq Scan on jobs | scan 7000/7000, loop 1; root 1/1 | none | 715/0; 3 | 0.193 | 2.882 | 3000 | ACCEPTABLE BASELINE BEHAVIOR; POSSIBLE FUTURE RISK at growth |
| Jobs secondary | Sort | Index Only Scan `jobs_pkey`; Bitmap Heap Scan plus Bitmap Index Scan `uk_job_skills_job_skill` | root 5/5, loop 1; primary-key 1/1; job skills 5/5 | quicksort, 25 kB, no spill | 16/0; 106 | 0.277 | 0.133 | 0 | VERIFIED QUERY FAN-OUT |
| Applications content | Limit | Index Scan `idx_jobs_company_id`; Index Scan `idx_applications_job_id` | join 500/5000; jobs 100/100 loop 1; applications 7/50 across 100 loops; root 20/20 | top-N heapsort, 46 kB, no spill | 4468/0; 376 | 0.648 | 3.828 | 0 | POSSIBLE FUTURE RISK |
| Applications count | Aggregate | Index Scan `idx_jobs_company_id`; Index Scan `idx_applications_job_id` | join 500/5000; jobs 100/100 loop 1; applications 7/50 across 100 loops; root 1/1 | none | 4462/0; 18 | 0.178 | 1.671 | 0 | POSSIBLE FUTURE RISK |
| Applications secondary | Index Scan | `jobs_pkey` | 1/1, loop 1 | none | 3/0; 48 | 0.091 | 0.009 | 0 | VERIFIED QUERY FAN-OUT |
| Public content | Limit | Seq Scan on companies | scan 80/80, loop 1; root 20/20 | top-N heapsort, 45 kB, no spill | 8/0; 125 | 0.241 | 0.074 | 20 | ACCEPTABLE BASELINE BEHAVIOR |
| Public count | Aggregate | Seq Scan on companies | scan 80/80, loop 1; root 1/1 | none | 5/0; 3 | 0.045 | 0.032 | 20 | ACCEPTABLE BASELINE BEHAVIOR |
| Public secondary | Aggregate | Index Scan `idx_jobs_company_id`; no Seq Scan | groups 100/20, loop 1; job scan 1400/1400 | none; index order supports grouping | 147/0; 107 | 0.193 | 0.512 | 600 | ACCEPTABLE BASELINE BEHAVIOR |

The applications content/count join is the major cardinality-estimation error: 500 planned rows versus 5,000 actual rows (10×), with 7 planned versus 50 actual application rows per job loop (about 7.14×). It caused neither a spill nor an expensive query at this scale, so the classification is **POSSIBLE FUTURE RISK**, not **VERIFIED BOTTLENECK**.

The public aggregate estimates 100 groups versus 20 actual groups (5×), but scans the predicted 1,400 job rows, remains buffer-local, and executes in 0.512 ms. The Sort nodes below a Limit return 20 rows because of demand from the parent; that is not itself a cardinality error.

The jobs and public-company sequential scans are not index recommendations. Jobs selects 7,000 of 10,000 rows (70%); public companies selects 80 of 100 rows (80%). Given the small tables, low selectivity, warm buffers, in-memory top-N sorts, and 4.528 ms maximum query time, they are acceptable baseline plans. Their growth behavior should be measured on larger data before changing access paths.

## 9. Verified bottlenecks

| Finding | Evidence | Impact | Classification |
|---|---|---|---|
| Jobs page mapping fan-out | source mapping plus 20 job-skill, 30 skill, and 11 company runtime calls | 61 avoidable service round trips; endpoint needs 66 SQL calls total | VERIFIED QUERY FAN-OUT |
| Company-application mapping fan-out | source mapping plus 18 student, 18 user, 9 job, and 2 CV runtime calls | 47 avoidable service round trips; endpoint needs 53 SQL calls total | VERIFIED QUERY FAN-OUT |

No individual SQL statement qualifies as a verified slow-query bottleneck from this evidence. The highest EXPLAIN execution time is 4.528 ms, all reads are buffer hits, and no plan spills.

## 10. Non-bottlenecks and false assumptions

- **Authentication overhead:** one user lookup at 0.166 ms or 0.056 ms is acceptable and explicitly separated from service SQL.
- **Transaction overhead:** 0.097 ms, 0.033 ms, and 0.036 ms is acceptable.
- **Sequential scan does not imply a missing index:** the observed jobs/company filters are low-selectivity on small tables and execute quickly.
- **Count queries:** currently 2.882 ms, 1.671 ms, and 0.032 ms. They are growth risks to monitor, not verified bottlenecks.
- **Sort/index behavior:** all top-N/quicksort operations fit in 25–66 kB; no temp I/O or disk spill occurred.
- **Wildcard search:** no keyword/search parameter was exercised. Classification: **NOT ENOUGH EVIDENCE**.
- **Response size:** 23,897, 15,203, and 9,094 bytes are controlled baseline measurements, not proof of latency causation.
- **Public companies:** three fixed service queries and sub-millisecond plans make it a useful control endpoint, not an optimization priority.

## 11. Recommended optimization order

1. **Jobs query fan-out.** Batch company and job-skill/skill data for the 20 job IDs while retaining correct pageable content/count semantics; avoid collection fetch joins on a pageable query. Trade-off: repository/mapping complexity and a larger but bounded batch query. Compare total SQL calls (66 toward approximately 6), service calls (63 toward approximately 3), p50/p95/p99 medians, throughput, DB execution/hits, failed checks, and unchanged 23,897-byte response semantics.
2. **Company-applications query fan-out.** Use a purpose-built DTO projection or controlled to-one fetch strategy for student/user/job/company/CV while keeping the count separate. Trade-off: wider content rows and careful page/count mapping. Compare total calls (53 toward approximately 6), service calls (50 toward approximately 3), medians, throughput, DB execution/hits, and unchanged 15,203-byte response semantics.
3. **List entity over-fetch.** After fan-out is removed, evaluate narrow list projections because Jobs hydrates text fields omitted from its response and application mapping hydrates full dependent rows. Trade-off: projection maintenance. Compare plan width, JDBC traffic, JVM allocation/GC, response bytes, and official endpoint metrics.
4. **Application estimate/buffer growth.** Re-test with larger and skewed company distributions. Consider a revised SQL shape or targeted planner statistics only if the plan materially degrades. Expected trade-off: extra statistics maintenance or query complexity can improve this distribution while regressing another. Compare planned/actual ratios, loops, hits/reads, temp I/O, content/count execution time, and endpoint tail latency.
5. **Jobs count/scan/sort growth.** Repeat at materially larger table sizes and with actual filter/search distributions before considering an access-path or pagination/count change. Expected trade-off: a future index adds storage and write amplification, while an alternate count/pagination design adds semantic and implementation complexity. Compare qualifying/filter rows, selectivity, shared hits/reads, sort memory/spill, count execution, p95/p99, and throughput.
6. **Public-companies control.** Preserve its fixed query shape as a regression comparator. Expected trade-off: optimizing a sub-millisecond fixed query offers little value and risks complexity or regression. Keep total/service SQL at 4/3, failed checks at zero, response bytes at 9,094, and compare its official latency/throughput medians after shared infrastructure changes.

No new index is justified solely by the present sequential scans, and no wildcard-search optimization is supported without a search workload.

## 12. Reproduction commands

Run from the repository root. Supply the performance-only password interactively; never write it into a result file or command line.

```powershell
$env:PERFORMANCE_PASSWORD = Read-Host 'Performance-only password'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\verify-dataset.ps1

$env:VUS = '10'
$env:ITERATIONS = '10000'
$baselineRoot = 'performance/results/baseline/<timestamp>-<git-sha>-native'

1..3 | ForEach-Object {
    $env:RESULT_DIRECTORY = "$baselineRoot/run-$_"
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\run-k6-baseline.ps1
}

# Run only after k6 has stopped; diagnostics are serial and not latency input.
$env:RESULT_DIRECTORY = "$baselineRoot/diagnostics"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\collect-environment-metadata.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\measure-query-count.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\performance\scripts\capture-explain-plans.ps1
```

Do not mix smoke/preflight measurements into the three-run aggregation. Phase B2 finalization did not rerun the 10,000-request workloads.

## 13. Evidence directory

Valid baseline directory:

```text
performance/results/baseline/20260722-203311-680bd870-native/
  run-1/
    metadata.json
    k6/<endpoint>/summary.json
  run-2/
    metadata.json
    k6/<endpoint>/summary.json
  run-3/
    metadata.json
    k6/<endpoint>/summary.json
  diagnostics/
    query-count/
    explain/
  baseline-summary.json
  baseline-summary.md
  evidence-manifest.md
```

`evidence-manifest.md` documents included/excluded artifacts and SHA-256 hashes. `baseline-summary.json` is the machine-readable source with numeric values rather than formatted metric strings. Raw summaries, metadata, console output, query counts, and plans were not changed.

## 14. Limitations

- This is one host, one concurrency level, one deterministic dataset, one page, and one parameter set. It is neither an SLA nor a system capacity limit.
- All query-count and plan evidence was warm/buffer-resident; cold-cache behavior is unmeasured.
- Dataset consistency is a deterministic row-count signature, not a content checksum.
- Database identity consistency is logical name/user/version metadata, not a physical cluster fingerprint.
- `pg_stat_statements` measures server execution but not network time, connection-pool wait, Hibernate hydration, mapper work, JSON serialization, JVM allocation/GC, or k6 scheduling.
- Query counts come from one isolated request per endpoint. The deterministic returned page supports the finding, but other pages may have different distinct-related-entity counts.
- Keyword/wildcard filters, alternative sorts, deeper pages, cold starts, mixed workloads, saturation, and long soak behavior are unmeasured.
- Raw run metadata and diagnostics retain the collector's stale Phase B1 tooling-validation `phase` label. Phase B2 identity is established by the explicit `run-1`/`run-2`/`run-3` structure and exact 10-VU × 10,000 measured-request summaries. The label is disclosed rather than mutating raw evidence.
- The result supplies no causality claim based on response size alone and invents no post-hoc latency target.

## 15. Interview-ready engineering summary

I built a reproducible baseline by tying three identical 10-VU × 10,000-request k6 runs to a fixed Git SHA, deterministic PostgreSQL dataset, isolated `pg_stat_statements` captures, and read-only JSON EXPLAIN plans. All 90,000 measured requests were correct, with no failures or dropped work. The authenticated endpoints were slower than the public control, but the database plans were buffer-resident and individually fast. Runtime SQL evidence exposed the actual issue: ORM mapping fan-out caused 66 SQL calls for Jobs and 53 for Company applications, versus four for Public companies. That distinction prevented a speculative indexing change. The first optimization should batch the Jobs page dependencies without changing the API or pagination, then compare SQL calls, official three-run median tails and throughput, database time/buffers, correctness, and response invariants against this baseline.
