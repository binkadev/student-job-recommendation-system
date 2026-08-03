# Backend (Spring Boot)

Spring Boot backend for the Student Job Recommendation System.

The backend is the system of record. It owns authentication, authorization, business rules, PostgreSQL persistence, Flyway migrations, eligible-job filtering, AI orchestration, AI response validation, recommendation ranking, and public API contracts.

## Current Integration Status

The backend currently integrates with the stateless bilingual AI Service through Contract V2:

- English CV ↔ English Job: `SAME_LANGUAGE_HYBRID`
- Vietnamese CV ↔ Vietnamese Job: `SAME_LANGUAGE_HYBRID`
- English CV ↔ Vietnamese Job: `CROSS_LANGUAGE_SKILL_BASED`
- Vietnamese CV ↔ English Job: `CROSS_LANGUAGE_SKILL_BASED`

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

The AI Service returns component scores, strategy, matched skills, missing skills, and an explanation. It does not return `rank` or `rankPosition`; the backend validates the response, sorts by `score DESC` then `jobId ASC`, assigns continuous ranks, and persists the results.

## Requirements

- Java 21
- Docker Desktop or Docker Engine with Compose
- Python 3.11 and the AI Service when testing CV analysis or recommendations end to end

## Run Database

From the repository root:

```powershell
docker compose up -d postgres
```

PostgreSQL runs on `localhost:5432` with development defaults:

- Database: `student_job_recommendation`
- Username: `postgres`
- Password: `123456`

Override them without editing source:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/student_job_recommendation"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="123456"
```

Docker Compose also supports `.env` values:

```text
POSTGRES_DB=student_job_recommendation
POSTGRES_USER=postgres
POSTGRES_PASSWORD=123456
```

These credentials are development defaults only.

## Run Backend

From the `backend` folder with the development profile:

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

For Git Bash, macOS, or Linux:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

The `dev` profile runs the local demo seeder. It creates missing demo users, profiles, skills, jobs, and job skills without duplicating them on restart. Existing demo passwords, roles, and statuses are not reset.

Backend base URL:

```text
http://localhost:8080
```

## CV File Storage

CV uploads and downloads resolve files only inside the backend-owned storage directory. The default is `uploads/cvs` relative to the backend working directory.

Override it without editing source:

```powershell
$env:APP_CV_UPLOAD_DIR="C:\path\to\private\cv-storage"
```

CV file endpoints preview inline by default. Add `?download=true` to request an attachment. Successful file responses stream raw bytes; JSON error responses retain the common API envelope. Internal storage paths and stored filenames are never returned.

## AI Service Configuration

Configure the synchronous AI client:

```powershell
$env:APP_AI_SERVICE_BASE_URL="http://localhost:8000"
$env:APP_AI_SERVICE_CONNECT_TIMEOUT="2s"
$env:APP_AI_SERVICE_READ_TIMEOUT="15s"
$env:APP_AI_SERVICE_INTERNAL_API_KEY="<same-secret-as-AI_INTERNAL_API_KEY>"
$env:APP_AI_RECOMMENDATION_ALGORITHM="tfidf-cosine-hybrid"
$env:APP_AI_RECOMMENDATION_ALGORITHM_VERSION="bilingual-recommendation-v2"
```

The currently implemented environment variable is
`APP_AI_SERVICE_INTERNAL_API_KEY` (not `APP_AI_INTERNAL_API_KEY`). It maps to
`app.ai-service.internal-api-key` and must contain the same secret as the AI
Service's `AI_INTERNAL_API_KEY`. Development has an explicit non-production
default; the production profile requires the environment value.

The URL, timeout, and algorithm variables have local defaults. Do not commit a
real internal key or write it to application logs.

Contract V2 calls:

- `POST /internal/v2/cv/parse` as multipart form data with field `file`
- `POST /internal/v2/recommendations` as strict JSON containing one CV and the backend-filtered eligible job corpus

Both calls send `X-Internal-Api-Key`. The backend never sends a user JWT or
database credentials to the AI Service.

## Request Tracing and Safe Logging

The request filter accepts a valid `X-Request-Id` from the client or generates a
UUID, stores it in MDC as `requestId`, and returns it in the response. The AI
client propagates the current request ID to both Contract V2 calls. Calls made
outside an HTTP request generate a valid outbound ID without leaving it in
thread context.

Backend request-completion logs contain only `requestId`, method, URI path,
status, and duration. They do not include query strings, authorization headers,
JWTs, cookies, passwords, internal API keys, request/response bodies, multipart
content, filenames, CV text, or Job text.

`X-Request-Id` is tracing metadata, not an authentication token. It is separate
from the Contract V2 body field `requestId`. See
[`../docs/operations/request-tracing.md`](../docs/operations/request-tracing.md).

## CV Analysis Behavior

Public student endpoints:

- `GET /api/students/me/cv/{cvId}/analysis`
- `PATCH /api/students/me/cv/{cvId}/extracted-data`
- `POST /api/students/me/cv/{cvId}/reanalyze`

Each uploaded CV starts at `NOT_READY` with empty extracted skills and warnings.

Reanalysis behavior:

1. Commit `PROCESSING` and clear derived analysis fields.
2. Reload the original PDF or DOCX.
3. Call the AI Service without an open database transaction.
4. Validate the response.
5. Save a valid response as `READY` in a new transaction.
6. Save failures as `FAILED` with cleared derived data and a sanitized error message.

A CV is usable for recommendations only when its persisted status is `READY` and its extracted and processed text are non-blank.

Parsed skills belong to the selected CV and are stored in `cv_files.extracted_skills`. They neither replace nor fall back to `student_skills`.

The AI Service owns semantic alias mapping, including equivalence such as:

- `học máy` / `hoc may` / `machine learning`
- `K8s` / `Kubernetes`
- `SpringBoot` / `spring-boot` / `Spring Boot`

The backend only performs defensive normalization and contract validation.

The extracted-data PATCH remains for compatibility but is intentionally unsupported in the MVP. An authenticated owner receives `501 FEATURE_NOT_SUPPORTED`, and no extracted text is mutated. Reanalysis always reads the original uploaded file.

## Recommendation Behavior

Public student endpoints:

- `POST /api/students/me/recommendations/generate`
- `GET /api/students/me/recommendation-runs`
- `GET /api/students/me/recommendation-runs/{runId}`
- `GET /api/students/me/recommendation-results/latest`

Recommendation generation uses only:

- the selected CV's original extracted text
- that CV's extracted canonical skills
- `ACTIVE` jobs
- jobs owned by `VERIFIED` companies
- jobs with a null, current, or future deadline

For same-language jobs with declared skills:

```text
score = 0.65 * textScore + 0.35 * skillScore
```

For same-language jobs without declared skills:

```text
score = textScore
```

For cross-language or insufficient-confidence pairs:

```text
textScore = null
score = skillScore
```

The backend rejects malformed results, duplicate job IDs, unexpected jobs, invalid score ranges, below-threshold results, incompatible strategy semantics, and other contract violations before persistence.

An empty eligible corpus still creates a successful run with zero jobs scanned and zero results, and does not call the AI Service.

The latest-results endpoint selects the latest `SUCCESS` run. Newer `FAILED` or `PROCESSING` runs do not hide the last successful result set.

## Recruiter Candidate Ranking

Company-only endpoints rank eligible Applications for one owned Job:

- POST /api/companies/me/jobs/{jobId}/candidate-ranking-runs
- GET /api/companies/me/jobs/{jobId}/candidate-ranking-runs?page=1&size=20
- GET /api/companies/me/jobs/{jobId}/candidate-ranking-runs/{runId}

The Backend starts from all Applications of the selected Job, includes only
PENDING or REVIEWED Applications with a submitted CV whose persisted analysis
is READY and has non-blank extracted and processed text, and records skip
counters for the remaining statuses. The submitted Application CV is used even
if it is not the Student's active CV. An empty eligible corpus is a successful
zero-result run and does not call AI.

Candidate Ranking is synchronous. The Backend commits PROCESSING, makes one
bulk Contract V2 call outside a database transaction, validates the complete
response, sorts by score DESC then applicationId ASC, generates the
human-facing reason, assigns rankPosition, and persists all results
transactionally. Failure is persisted as FAILED with a sanitized message. The
AI Service never receives a user JWT and never assigns public rank.

See [the Candidate Ranking contract](../docs/candidate-ranking-contract.md) and
[the final verification evidence](../docs/final-verification.md).

## Demo Accounts

All demo accounts use password `123456`.

- Admin: `admin@example.com`
- Student: `student@example.com`
- Company: `company@example.com`

## Swagger

Swagger UI:

```text
http://localhost:8080/swagger-ui.html
```

Use `POST /api/auth/login` with a demo account to get a JWT. Click **Authorize**, enter `Bearer <token>`, and test protected APIs.

## Tests

Run fast smoke and unit tests without Docker or PostgreSQL:

```powershell
.\mvnw.cmd -B -ntp test
```

Run the complete lifecycle, including PostgreSQL integration tests:

```powershell
.\mvnw.cmd -B -ntp clean verify
```

The integration-test layer requires Docker. Maven Failsafe starts PostgreSQL 17 through Testcontainers, applies Flyway migrations, and validates Hibernate mappings. It does not use the local development database or its credentials.

AI client unit tests use an in-process HTTP stub. PostgreSQL API integration tests also use a controlled stub to cover successful and failed parsing and recommendation orchestration without requiring an external Python process.

## Important API Groups

- Public companies: `GET /api/public/companies`, `GET /api/public/companies/{id}`
- Public jobs: `GET /api/public/jobs`, `GET /api/public/jobs/{jobId}`
- Public statistics: `GET /api/public/statistics`
- Admin users: list, detail, and status update
- Admin companies: list, detail, and status update
- Admin applications: list and detail
- Company applications: list, detail, CV streaming, and status update
- Saved candidates: list, save by owned application, and delete
- Notification settings: get and full replacement update
- Student saved searches: CRUD
- Password change: `PATCH /api/users/me/password`
- Student CV: metadata, file streaming, active selection, deletion, analysis, and reanalysis
- Recommendations: generation, history, run detail, and latest successful results

See `../docs/api-contract.md` for request parameters, response fields, enum values, privacy constraints, and error semantics.

## Current MVP Limitations

- No OCR for image-only CVs
- No embeddings, semantic vector search, or vector database
- No asynchronous queue for CV analysis or recommendation generation
- No immutable snapshots of historical CV text, job documents, or eligible corpora
- No concurrent reanalysis guard such as a row lock or analysis-attempt identifier
- No manual extracted-text editing
- Job-skill importance and minimum proficiency are not yet included in the AI V2 scoring contract

Vietnamese NLP and semantic skill aliases are implemented in the AI Service. They are intentionally not duplicated in the backend.
