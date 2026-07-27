# Student Job Recommendation System

A graduation-project MVP for recommending IT jobs to students from CV content using Content-Based Filtering, bilingual English/Vietnamese text processing, TF-IDF, Cosine Similarity, and canonical skill matching.

## Source of truth

The canonical integration branch is `master`. New work must start from the latest `master` and return through a reviewed pull request. Personal or legacy branches are not sources of domain behavior.

## Repository status

The repository currently contains:

- `backend/`: Java 21 and Spring Boot 3.5.x REST API
- `ai-service/`: Python 3.11 and FastAPI bilingual CV/recommendation service
- `docs/`: API, database, ERD, and regression documentation
- `performance/`: reproducible PostgreSQL/API benchmark tooling and evidence
- `docker-compose.yml`: PostgreSQL 17 for local development only

The current `master` branch does not contain a buildable frontend package manifest and lockfile. Frontend work exists outside the verified master integration flow, so end-to-end frontend claims require a reviewed merge plus runtime evidence.

## Architecture

```text
Client / Frontend
       |
       v
Spring Boot Backend
  |             |
  v             v
PostgreSQL   FastAPI AI Service
```

The backend is the system of record. It owns authentication, authorization, business rules, persistence, transactions, eligible-job filtering, AI orchestration, AI-response validation, deterministic ranking, and public API contracts.

The AI Service is stateless. It owns PDF/DOCX text extraction, English/Vietnamese language detection and preprocessing, canonical skill extraction, TF-IDF/Cosine scoring, cross-language skill matching, and deterministic explanations. It never accesses PostgreSQL and never receives user JWTs.

## Recommendation Contract V2

Current internal endpoints:

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

V1 endpoints remain only for compatibility and regression coverage.

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

| CV and Job language | Strategy | Text score | Final score |
|---|---|---:|---:|
| English ↔ English | `SAME_LANGUAGE_HYBRID` | Used | `0.65 * textScore + 0.35 * skillScore` when job skills exist |
| Vietnamese ↔ Vietnamese | `SAME_LANGUAGE_HYBRID` | Used | `0.65 * textScore + 0.35 * skillScore` when job skills exist |
| English ↔ Vietnamese | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |
| Vietnamese ↔ English | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |
| Mixed or low-confidence pair | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |

For same-language jobs without declared skills, the final score is `textScore`.

AI does not return rank. The backend validates every result, rejects scores below the requested threshold, sorts by `score DESC` then `jobId ASC`, and assigns continuous `rankPosition` values.

## Docker Compose scope

The current root Compose file is database infrastructure only.

| Component | Included in current Compose |
|---|---|
| PostgreSQL | Yes |
| Spring Boot Backend | No |
| FastAPI AI Service | No |
| Frontend | No |

A full-stack Compose deployment remains future work. Do not describe the current repository as fully containerized.

## Quick start

### 1. Start PostgreSQL

From the repository root:

```powershell
docker compose up -d postgres
```

Development defaults:

- Host: `localhost:5432`
- Database: `student_job_recommendation`
- Username: `postgres`
- Password: `123456`

These values are local-development defaults only.

### 2. Start the AI Service

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Current bilingual health metadata:

```text
GET http://localhost:8000/health/v2
```

Legacy-compatible health metadata remains at `GET /health`. OpenAPI is available at `http://localhost:8000/docs` for local development.

### 3. Start the Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Backend base URL: `http://localhost:8080`

Swagger UI: `http://localhost:8080/swagger-ui.html`

## CORS configuration

Development origins default to:

```text
http://localhost:3000,http://localhost:5173
```

Override them without editing source:

```powershell
$env:APP_CORS_ALLOWED_ORIGINS="http://192.168.1.10:5173,https://demo.example.com"
$env:APP_CORS_ALLOW_CREDENTIALS="false"
```

Origins are trimmed and de-duplicated. Wildcard origin `*` is rejected when credentials are enabled. The application uses Bearer JWT, so credentials are disabled by default.

## Verification

Backend:

```powershell
cd backend
.\mvnw.cmd -B -ntp test
.\mvnw.cmd -B -ntp clean verify
```

AI Service:

```powershell
cd ai-service
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m pytest
```

GitHub Actions currently contains separate Backend and AI Service workflows. A Frontend workflow is intentionally not added until `master` contains a reviewed package manifest, lockfile, and executable scripts.

## Main business areas

- JWT authentication and role authorization
- Student profile and confirmed skills
- Company profile and job management
- Application lifecycle
- CV upload, file streaming, active selection, bilingual analysis, and reanalysis
- Public jobs, companies, and platform statistics
- Saved jobs, saved searches, and saved candidates
- Notifications and notification settings
- Recommendation generation, history, component scores, missing skills, and explanations
- Admin management APIs

## Documentation

- Backend setup and behavior: [`backend/README.md`](backend/README.md)
- AI Service setup and behavior: [`ai-service/README.md`](ai-service/README.md)
- API contract: [`docs/api-contract.md`](docs/api-contract.md)
- Database schema: [`docs/database-schema.md`](docs/database-schema.md)
- DBML ERD source: [`docs/database-erd.dbml`](docs/database-erd.dbml)
- Postman regression notes: [`docs/postman-regression.md`](docs/postman-regression.md)
- Contributor and agent rules: [`AGENTS.md`](AGENTS.md)

## Current MVP limitations

- No OCR for image-only CVs
- No embeddings, semantic vector model, or vector database
- No asynchronous CV/recommendation queue
- No production service-to-service authentication between Backend and AI
- No immutable historical snapshot of the source CV/job corpus
- No concurrent reanalysis attempt guard
- No manual extracted-text editing
- Job-skill importance and minimum proficiency are not yet included in AI V2 scoring
- No full-stack Docker Compose
- No verified frontend package and CI workflow on `master`
