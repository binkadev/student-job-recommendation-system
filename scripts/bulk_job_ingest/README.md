# Bulk Company & Job CSV Ingestion Tool

Safe, resumable API ingestion CLI under `scripts/bulk_job_ingest/` for grouping `job.csv` by unique `name`, creating and verifying `COMPANY` accounts (`ptithcm{i:04d}@gmail.com` / `000000`), syncing canonical IT skills (`ai-service/resources/skill_catalog.v1.json`), and creating/activating jobs via Backend REST APIs.

## Key Safeguards
- **Zero Backend / AI code edits**.
- **Deterministic Company Grouping**: Collapses internal whitespace on `name` (truncated `<= 255` chars), groups case-insensitively, sorts alphabetically for `ptithcm0000`, `ptithcm0001`, ...
- **Duplicate-Safe Retry Recovery**: Distinct CSV rows sharing the same `name` legitimately share `(companyId, title)`. On timeout retry, the worker excludes every `job_id` already claimed in `state.sqlite` (`UNIQUE` index) and verifies `description` + `requirements` equality before reusing an orphan job.
- **Canonical Skill Linking**: Syncs all 89 canonical skills via `ADMIN` `/api/skills` and extracts matched `skillIds` from `name + description + requirment`.

## PowerShell Commands (from Repository Root)

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 1. Dry Run — inspect CSV counts, blank skips, truncations, and grouping
python -m scripts.bulk_job_ingest `
  --csv-path "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\job\job.csv" `
  --run-name jobs-15k `
  --dry-run

# 2. Pilot Run — test first 10 jobs (creates & verifies their companies, syncs skills, activates 10 jobs)
python -m scripts.bulk_job_ingest `
  --csv-path "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\job\job.csv" `
  --run-name pilot-10 `
  --limit 10

# 3. Full Run — register & verify all unique companies, then create & activate all ~15,000 jobs
# (Resumable anytime on rerun with the exact same command)
python -m scripts.bulk_job_ingest `
  --csv-path "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\job\job.csv" `
  --run-name jobs-15k `
  --company-concurrency 6 `
  --job-concurrency 8

# 4. Retry transient failures only (if summary.json reports any retryable failures)
python -m scripts.bulk_job_ingest `
  --csv-path "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\job\job.csv" `
  --run-name jobs-15k `
  --retry-failed
```
