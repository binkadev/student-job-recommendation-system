# Backend (Spring Boot)

Spring Boot backend for the Student Job Recommendation System.

The backend is the system of record. It owns authentication, authorization, business rules, PostgreSQL persistence, Flyway migrations, eligible-job filtering, AI orchestration, AI response validation, deterministic recommendation ranking, and public API contracts.

## Current integration status

The backend integrates with the stateless bilingual AI Service through Contract V2:

- English CV ↔ English Job: `SAME_LANGUAGE_HYBRID`
- Vietnamese CV ↔ Vietnamese Job: `SAME_LANGUAGE_HYBRID`
- English CV ↔ Vietnamese Job: `CROSS_LANGUAGE_SKILL_BASED`
- Vietnamese CV ↔ English Job: `CROSS_LANGUAGE_SKILL_BASED`

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

The AI Service returns component scores, strategy, matched skills, missing skills, and a deterministic explanation. It does not return `rank` or `rankPosition`. The backend validates the response, rejects below-threshold results, sorts by `score DESC` then `jobId ASC`, assigns continuous `rankPosition` values, and persists the result set.

Vietnamese NLP and semantic skill aliases are implemented in the AI Service. The backend intentionally does not duplicate NLP, translation, or semantic alias logic.

## Requirements

- Java 21
- Maven Wrapper or Maven 3.9.x
- Docker Desktop or Docker Engine for PostgreSQL/Testcontainers
- Python 3.11 and the AI Service for end-to-end CV/recommendation testing

## Docker Compose scope

The root `docker-compose.yml` starts PostgreSQL 17 only.

| Component | Included in current Compose |
|---|---|
| PostgreSQL | Yes |
| Backend | No |
| AI Service | No |
| Frontend | No |

Run the local database from the repository root:

```powershell
docker compose up -d postgres
```

Development defaults:

- Database: `student_job_recommendation`
- Username: `postgres`
- Password: `123456`
- Host: `localhost:5432`

These are local-development defaults only and must not be reused in production.

## Run Backend

From `backend/`:

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Git Bash, Linux, or macOS:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Backend base URL:

```text
http://localhost:8080
```

The `dev` profile runs the demo seeder. Demo accounts and password `123456` are for local development only.

## CORS configuration

CORS is configured through typed `app.cors` properties rather than hard-coded production origins.

Defaults:

```yaml
app:
  cors:
    allowed-origins: http://localhost:3000,http://localhost:5173
    allow-credentials: false
```

PowerShell override:

```powershell
$env:APP_CORS_ALLOWED_ORIGINS="http://192.168.1.10:5173,https://demo.example.com"
$env:APP_CORS_ALLOW_CREDENTIALS="false"
```

Behavior:

- origins are trimmed and de-duplicated;
- blank configuration is rejected;
- wildcard `*` is rejected when credentials are enabled;
- Bearer JWT is used, so credentials are disabled by default;
- `Content-Disposition` is exposed for CV preview/download responses.

## CV file storage

The default storage directory is `uploads/cvs` relative to the backend working directory.

```powershell
$env:APP_CV_UPLOAD_DIR="C:\path\to\private\cv-storage"
```

File endpoints stream bytes and expose only sanitized filenames. They never return `filePath`, `storedFileName`, the storage directory, or an absolute path.

## AI Service configuration

```powershell
$env:APP_AI_SERVICE_BASE_URL="http://localhost:8000"
$env:APP_AI_SERVICE_CONNECT_TIMEOUT="2s"
$env:APP_AI_SERVICE_READ_TIMEOUT="15s"
$env:APP_AI_RECOMMENDATION_ALGORITHM="tfidf-cosine-hybrid"
$env:APP_AI_RECOMMENDATION_ALGORITHM_VERSION="bilingual-recommendation-v2"
```

Contract V2 calls:

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

The backend never sends a user JWT or database credentials to the AI Service. Production service-to-service authentication is not implemented yet.

## CV analysis behavior

Public student endpoints:

- `GET /api/students/me/cv/{cvId}/analysis`
- `PATCH /api/students/me/cv/{cvId}/extracted-data`
- `POST /api/students/me/cv/{cvId}/reanalyze`

State machine:

```text
NOT_READY → PROCESSING → READY | FAILED
```

Reanalysis:

1. commits `PROCESSING` and clears derived analysis fields;
2. reloads the original PDF/DOCX;
3. calls AI without an open database transaction;
4. validates the strict V2 response;
5. saves success as `READY` in a new transaction;
6. saves failure as `FAILED` with cleared derived data and a sanitized error.

A CV can generate recommendations only when status is `READY` and both extracted and processed text are non-blank.

Extracted skills belong to the selected CV in `cv_files.extracted_skills`; they never fall back to `student_skills`.

The extracted-data PATCH is retained only for compatibility and returns `501 FEATURE_NOT_SUPPORTED` after authentication and ownership checks. Reanalysis always reads the original file.

## Recommendation behavior

Public student endpoints:

- `POST /api/students/me/recommendations/generate`
- `GET /api/students/me/recommendation-runs`
- `GET /api/students/me/recommendation-runs/{runId}`
- `GET /api/students/me/recommendation-results/latest`

Eligible jobs are:

- `ACTIVE`;
- owned by a `VERIFIED` company;
- deadline null, today, or in the future.

Scoring:

```text
same language + declared skills:
score = 0.65 * textScore + 0.35 * skillScore

same language + no declared skills:
score = textScore

cross language / low confidence:
textScore = null
score = skillScore
```

The backend rejects malformed results, duplicate or unexpected job IDs, invalid score ranges, scores below the request threshold, and incompatible strategy semantics before persistence.

An empty eligible corpus creates a successful run with zero scanned jobs and zero results without calling AI.

The latest-results endpoint selects the latest `SUCCESS` run. Newer `FAILED` or `PROCESSING` runs do not hide the last successful results.

## Swagger

```text
http://localhost:8080/swagger-ui.html
```

## Tests and CI

Fast tests:

```powershell
.\mvnw.cmd -B -ntp test
```

Full PostgreSQL integration lifecycle:

```powershell
.\mvnw.cmd -B -ntp clean verify
```

The integration layer uses PostgreSQL 17 through Testcontainers, applies all Flyway migrations, and validates Hibernate mappings.

GitHub Actions:

- `.github/workflows/backend-ci.yml` validates Backend changes;
- `.github/workflows/ai-ci.yml` validates the bilingual AI Service separately.

See `../docs/api-contract.md` for endpoint details and `../docs/database-schema.md` for the Flyway V1–V15 schema.

## Current MVP limitations

- No OCR for image-only CVs
- No embeddings, semantic vector search, or vector database
- No asynchronous queue for CV analysis or recommendations
- No production internal authentication between Backend and AI Service
- No immutable historical snapshots of CV text, job documents, or eligible corpora
- No concurrent reanalysis guard such as a row lock or attempt identifier
- No manual extracted-text editing
- Job-skill importance and minimum proficiency are not part of AI V2 scoring
- No full-stack Docker Compose
