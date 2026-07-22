# Performance Results

This directory holds generated measurement evidence. Phase B1 creates only smoke correctness and bounded diagnostic evidence; it creates no final latency or throughput baseline.

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

Each run can contain:

- A completed run metadata record.
- One endpoint result record per measured endpoint.
- k6 console and aggregate JSON output in the applicable `smoke/` or `k6/` subtree.
- Bounded SQL query-count evidence.
- PostgreSQL EXPLAIN output.

Do not store passwords, JWTs, JDBC bind values, personal data, or production data here.

Generated `baseline/*/` directories are ignored by default. Only intentionally reviewed small text, JSON, or Markdown evidence may be committed later. Phase B1 observations must not be represented as final baseline conclusions.
