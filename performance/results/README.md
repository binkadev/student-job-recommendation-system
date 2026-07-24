# Performance Results

This directory holds generated measurement evidence. Phase B1 creates smoke correctness and bounded diagnostic evidence. The official Phase B2 baseline is finalized at:

```text
baseline/20260722-203311-680bd870-native/
```

The scripts create this structure:

```text
baseline/<timestamp>-<git-sha>/
  metadata.json
  metadata.md
  smoke/
  query-count/
  explain/
  k6/
```

Each generated run can contain:

- A completed run metadata record.
- One endpoint result record per measured endpoint.
- k6 console and aggregate JSON output in the applicable `smoke/` or `k6/` subtree.
- Bounded SQL query-count evidence.
- PostgreSQL EXPLAIN output.

Do not store passwords, JWTs, JDBC bind values, personal data, or production data here.

Generated `baseline/*/` directories are ignored by default. Only intentionally reviewed small text, JSON, or Markdown evidence may be committed later. Passwords, tokens, authorization headers, personal paths, and binary artifacts must not be included.

## Official Phase B2 selection

Only these directories contribute latency and throughput values:

- `20260722-203311-680bd870-native/run-1/`
- `20260722-203311-680bd870-native/run-2/`
- `20260722-203311-680bd870-native/run-3/`

Each contains all three selected endpoints at 10 VUs and exactly 10,000 measured requests. All nine endpoint summaries have zero HTTP failures, zero failed checks, and zero dropped iterations.

The following are intentionally excluded from latency aggregation:

- `preflight/`: 1,000-request exploratory evidence.
- `smoke/`: five-iteration correctness evidence.
- `diagnostics/`: one isolated request per endpoint and read-only EXPLAIN evidence.

Use these reviewed derivative files:

- `baseline-summary.json`: machine-readable raw metrics, medians, query counts, and plan facts.
- `baseline-summary.md`: official human-readable summary and prioritized findings.
- `evidence-manifest.md`: evidence selection, provenance limitations, and raw-artifact SHA-256 hashes.

Raw run metadata and diagnostics retain a stale Phase B1 collector label and are not modified. The explicit `run-1`/`run-2`/`run-3` layout and their 10-VU × 10,000-request summaries establish the Phase B2 workload. Phase B1 smoke latency remains invalid as baseline evidence.
