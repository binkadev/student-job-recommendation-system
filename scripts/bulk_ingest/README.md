# Bulk Student Account & CV PDF Ingestion Tool

Safe, resumable REST API ingestion CLI under `scripts/bulk_ingest/` for creating `STUDENT` accounts and uploading prepared `.pdf` CVs via the existing Backend APIs.

## Scope & Behavior
- **Endpoints called**:
  1. `GET /api/public/statistics` (preflight Backend reachability check)
  2. `POST /api/auth/register` (`email=n22dccn{i:04d}@gmail.com`, `password=000000`, `role=STUDENT`, `fullName=n22dccn{i:04d}`, `phone` omitted)
  3. `POST /api/auth/login`
  4. `GET /api/students/me/cv` (idempotent check when recovering `409` or prior partial states)
  5. `POST /api/students/me/cv?active=true` (multipart `"file"`, `application/pdf`)
- **Deferred intentionally**: Does **NOT** call `POST /api/students/me/cv/{cvId}/reanalyze` and does **NOT** require `ai-service` to be running. Uploaded CVs remain at `analysis_status = NOT_READY`.
- **Crash recovery**: Locks `idx -> email -> rel_path -> sha256` into `scripts/bulk_ingest/runs/<run-name>/state.sqlite` on the first run and refuses shifted indices on reruns.

## Usage (PowerShell from Repository Root)

```powershell
# 1. Dry run (validate PDF headers, sizes <= 10 MiB, sanitized names <= 255 chars, disk size)
python -m scripts.bulk_ingest `
  --input-dir "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\cv_pdf_output" `
  --run-name batch-5k `
  --dry-run

# 2. Pilot run on the first 10 CVs
python -m scripts.bulk_ingest `
  --input-dir "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\cv_pdf_output" `
  --run-name pilot-10 `
  --limit 10

# 3. Full run across all 5,000+ CVs (safe concurrency = 6)
python -m scripts.bulk_ingest `
  --input-dir "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\cv_pdf_output" `
  --run-name batch-5k `
  --concurrency 6

# 4. Retry only transient network / 5xx failures (if any occurred)
python -m scripts.bulk_ingest `
  --input-dir "C:\Users\HP\Downloads\Tốt nghiệp\tltk tn\dataset\cv_pdf_output" `
  --run-name batch-5k `
  --retry-failed
```

## Outputs per Run (`scripts/bulk_ingest/runs/<run-name>/`)
- `state.sqlite` — Resumable manifest including `user_id` and `cv_id`
- `run.log` — Structured execution log (without passwords or JWTs)
- `summary.json` — Status counts & throughput metrics
- `failures.csv` — Triage sheet for any failed items
