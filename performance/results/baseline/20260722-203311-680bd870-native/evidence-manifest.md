# Phase B2 Evidence Manifest

## Decision

The official Phase B2 baseline is **VALID** and uses only `run-1`, `run-2`, and `run-3` for latency, throughput, request-count, error, check, dropped-iteration, response-byte, and duration aggregation.

| Gate | Result |
|---|---|
| Branch | `perf/api-db-baseline` |
| Identical Git SHA | PASS — `680bd8709b3044a2710e2f5f5fcc067878086ee1` |
| Identical database identity | PASS — `student_job_recommendation_perf` / `perf_user`, PostgreSQL 17.10 |
| Identical dataset | PASS — 142,651 total rows and matching per-table counts |
| Identical workload | PASS — 10 VUs and 10,000 measured iterations per endpoint |
| Identical endpoint parameters | PASS |
| Nine endpoint/run summaries present | PASS |
| Each summary has exactly 10,000 measured requests | PASS |
| HTTP failures / failed checks / dropped iterations | PASS — 0 / 0 / 0 in every summary |

## Artifact selection

Included in official latency aggregation:

- `run-1/k6/*/summary.json`
- `run-2/k6/*/summary.json`
- `run-3/k6/*/summary.json`

Used for run identity and consistency validation:

- `run-1/metadata.json`
- `run-2/metadata.json`
- `run-3/metadata.json`

Used only as supporting, serial database diagnostics:

- `diagnostics/query-count/*.json`
- `diagnostics/explain/*.json`
- `diagnostics/metadata.json`

Explicitly excluded from latency aggregation:

| Directory | Reason |
|---|---|
| `preflight/` | Exploratory 1,000-request workload, not an official 10,000-request run |
| `smoke/` | Five-iteration correctness validation; smoke latency is not baseline evidence |
| `diagnostics/` | One isolated request per endpoint plus read-only SQL plans; diagnostic evidence only |

No timeout, failed, or partial directory is included. Authenticated setup logins are tagged unmeasured in k6. Their one additional HTTP request is not included in the measured endpoint count or latency submetrics.

## Derived artifacts

| File | Purpose |
|---|---|
| `baseline-summary.json` | Structured source-precision raw values, medians, diagnostic totals, plan facts, and validity result |
| `baseline-summary.md` | Human-readable official baseline and engineering analysis |
| `evidence-manifest.md` | Selection rules, provenance, and raw-artifact integrity hashes |

These three files are derived; all raw run and diagnostic files remain unchanged.

## Raw-evidence integrity

SHA-256 values below cover every file used for the official runs or supporting diagnostics, including console and Markdown companions. Paths are relative to this baseline directory.

| Raw artifact | SHA-256 |
|---|---|
| `diagnostics/explain/20260722-135139380-company-applications-content.json` | `4edf2ba6ed097bca5a785c60eb47e794b579b5f2d6205aa026817f4bb1f24b9a` |
| `diagnostics/explain/20260722-135139380-company-applications-count.json` | `1524d9acd5523989b5a330065f24cd4353bbcdf684a56b59544d72950e63330f` |
| `diagnostics/explain/20260722-135139380-company-applications-secondary.json` | `afbad06c2e1c1d08a91a3848daf0c6a1b98adcfbab118590ea222c13a5b9f41b` |
| `diagnostics/explain/20260722-135139380-jobs-list-content.json` | `5a77369a377b02c5f399dbec513a19b41d8c7f5ccdfac09dd58577b30724f27f` |
| `diagnostics/explain/20260722-135139380-jobs-list-count.json` | `70d21287d7dd7b2438b0fd74934c36b457362cb00e1710728c013ca91cf4cc1f` |
| `diagnostics/explain/20260722-135139380-jobs-list-secondary.json` | `9347d953e4dca04bb79d9a54d44abac5a5706ad3a633c92347d3b7387763ee99` |
| `diagnostics/explain/20260722-135139380-manifest.json` | `bbe2c790ec57aab1227c8fc16f8426235bf1493b8b35371c8aa7f29554bc70a2` |
| `diagnostics/explain/20260722-135139380-public-companies-content.json` | `587f842c255a91155c26cb580e08b11060e595e110a74235fa9fefa71a0010a8` |
| `diagnostics/explain/20260722-135139380-public-companies-count.json` | `ceff5f9ce4c74a472d7d947bbe051d31523396671d15eb0f5d6a4d0108e7b8a5` |
| `diagnostics/explain/20260722-135139380-public-companies-secondary.json` | `5b04f2bf92e6433706b89b562e5266affcd70ab03beddffbb78b856cd2e83c49` |
| `diagnostics/metadata.json` | `010a9dd835dd893d0832521e1f66031a4e8f059ef15621576e8123fb261037d1` |
| `diagnostics/metadata.md` | `0dcd7af818d0414fd1ec000e903632681e9a55dd333e2b294b6ecbe622f6228c` |
| `diagnostics/query-count/20260722-135133333-jobs-list.json` | `d7ccac5b235dd717269b6da00f807c10a6effc6103675c0dc776ffdee62b6a0c` |
| `diagnostics/query-count/20260722-135134237-company-applications.json` | `aa617d24e4d90fcc2570818e8e232fec560d3ffcd4fc0186079cbe37e721b9da` |
| `diagnostics/query-count/20260722-135135071-public-companies.json` | `45e8e68d54f3976f5e494cc1d98f5e1561c6598be74902430deda504544ce16c` |
| `run-1/k6/company-applications/console.txt` | `3b2dc4f8fbdb05ab075cf30b02c06be0cdd072259a87d0e254245e9f1410f347` |
| `run-1/k6/company-applications/summary.json` | `4729f5094492144c339a28eca1ba0d7abf5d70059e8cfb413f2ddb2b4dd26f50` |
| `run-1/k6/jobs-list/console.txt` | `c5f69438998228f8dddd4f948b4e92627402ed4dc934e08c26a33ac0edbf4761` |
| `run-1/k6/jobs-list/summary.json` | `27d69f6bba4ac6bc084c0d436a571df623be351650044c3ee4fce1e543823a43` |
| `run-1/k6/public-companies/console.txt` | `80ca7ce4799d917bc3a44aca458616eb3304c614fa89725fec2a822f361d706a` |
| `run-1/k6/public-companies/summary.json` | `f67d9229c3d727ce4651cc6fbaa24681a07410f59ca74cce15015acd75d1ef58` |
| `run-1/metadata.json` | `983eca78172f595a996f6b57a8eb2e3e464a47a38ee51faa83246c0e909698c1` |
| `run-1/metadata.md` | `922786cf58543035451e71727ad0f174aa56e862394ffc5326c9e9f4ab2f06b5` |
| `run-2/k6/company-applications/console.txt` | `4360c7477c39bbcf8bce1c0288893971a89acd2418dc0106a5f4f1203dfeae1b` |
| `run-2/k6/company-applications/summary.json` | `71b3e4e02e23b818fa9df69b717fdc142f36ab54309ebf783d9b6fb85eb05716` |
| `run-2/k6/jobs-list/console.txt` | `274c1e17498b8523fc7376fb9297e81efd6b0bc13e9431280c87d95730e7a222` |
| `run-2/k6/jobs-list/summary.json` | `46cfcd332d42ee3addee1f61581ee1ba3ea0478fd44f2ad2407452c771a666f3` |
| `run-2/k6/public-companies/console.txt` | `1c30109c1fec2a2fb45e529c4be0652f1a786141c6bce09ce32cff34b9e0f6de` |
| `run-2/k6/public-companies/summary.json` | `fd8915dff17f2fd55bf075bb3c6ba50522eaa3f9932585793d6ca80272f008b6` |
| `run-2/metadata.json` | `dd93a117518eec6170f52dc169f5f78809d64832304d3315f8aefcd3abd4754e` |
| `run-2/metadata.md` | `0312eebbfa15ae067db19f17c5b6322491f4862e00e303882bcd7e179a8ffb23` |
| `run-3/k6/company-applications/console.txt` | `170468303da1a7a07c9bfb395be1cd7a9b2167e0789631c776f36cce919a88ba` |
| `run-3/k6/company-applications/summary.json` | `1f797b25e2c0fb1c1745c544a4840f67a204c3cc747bd414428ff61ce2c6e065` |
| `run-3/k6/jobs-list/console.txt` | `9cbcc048d598bd378cda20a29f3e6e5d4df75051fc88170453ba29fc191515d7` |
| `run-3/k6/jobs-list/summary.json` | `da661cbd1f405c8571a7feb25fc475f51236e74ac7d023e42deb51ac41d10aab` |
| `run-3/k6/public-companies/console.txt` | `1c34f441cb7b037a84e6bf283d5216373798079e038efa1f08594e03752529fc` |
| `run-3/k6/public-companies/summary.json` | `2145332a1874c5621ca6e14f85e6c8b15e54f4b6766ae9674fca601a79b26855` |
| `run-3/metadata.json` | `aaab24595e2c84a95dee5ec59f39bd27ae29008f45607f88b2d61f4a681cd48e` |
| `run-3/metadata.md` | `584ab043ce9f9c290099209e0ef07e20d1b6ad1f900117d7bcbe2e97e804a385` |

## Provenance limitation

The `run-1`, `run-2`, and `run-3` metadata files retain the collector's `B1 measurement tooling validation; not a final baseline` phase label. Query-count and EXPLAIN files retain their corresponding B1 diagnostic labels. These are stale collector labels: Phase B2 identity is established by the explicit three-run structure and exact 10-VU × 10,000-measured-request summaries, while diagnostics are used only for isolated SQL-call and plan analysis. The original labels are retained to preserve evidence integrity.
