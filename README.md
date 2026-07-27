# Student Job Recommendation System

A graduation-project MVP for recommending IT jobs to students from CV content using Content-Based Filtering, bilingual text processing, TF-IDF, Cosine Similarity, and canonical skill matching.

## Repository Status

The canonical integration branch is `master`.

This repository currently contains:

- `backend/`: Java 21 and Spring Boot 3.5.x REST API
- `ai-service/`: Python 3.11 and FastAPI bilingual CV/recommendation service
- `docs/`: API contracts and regression documentation
- `performance/`: reproducible PostgreSQL/API benchmark tooling and evidence
- `docker-compose.yml`: local PostgreSQL 17 development database

The production frontend source is not currently stored in this repository. Frontend completeness must not be inferred from this codebase alone.

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

The backend is the system of record and owns authentication, authorization, business rules, database access, transactions, eligible-job filtering, AI orchestration, validation, ranking, and persistence.

The AI Service is stateless and owns file extraction, bilingual NLP, canonical skill extraction, similarity scoring, and explanations. It does not access PostgreSQL and does not receive user JWTs.

## Recommendation Contract V2

Internal endpoints:

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

Strategies:

| CV and Job language | Strategy | Text score | Final score |
|---|---|---:|---:|
| English ↔ English | `SAME_LANGUAGE_HYBRID` | Used | `0.65 * textScore + 0.35 * skillScore` when job skills exist |
| Vietnamese ↔ Vietnamese | `SAME_LANGUAGE_HYBRID` | Used | `0.65 * textScore + 0.35 * skillScore` when job skills exist |
| English ↔ Vietnamese | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |
| Vietnamese ↔ English | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |
| Mixed or low-confidence pair | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |

When a same-language job has no declared skills, the final score is the text score alone.

AI returns no rank. The backend sorts by `score DESC`, then `jobId ASC`, and assigns continuous `rankPosition` values.

## Quick Start

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

### 2. Start the AI Service

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements.lock
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Health endpoint:

```text
http://localhost:8000/health
```

OpenAPI:

```text
http://localhost:8000/docs
```

### 3. Start the Backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Backend base URL:

```text
http://localhost:8080
```

Swagger UI:

```text
http://localhost:8080/swagger-ui.html
```

## Verification

Backend fast tests:

```powershell
cd backend
.\mvnw.cmd -B -ntp test
```

Backend full PostgreSQL integration lifecycle:

```powershell
cd backend
.\mvnw.cmd -B -ntp clean verify
```

AI Service tests:

```powershell
cd ai-service
python -m pip check
python -m pytest
```

## Main Business Areas

- JWT authentication and role authorization
- Student profile and skills
- Company profile and job management
- Application lifecycle
- CV upload, streaming, active selection, analysis, and reanalysis
- Public jobs, companies, and statistics
- Saved jobs, saved searches, and saved candidates
- Notifications and notification settings
- Bilingual CV parsing and job recommendation
- Recommendation history, component scores, missing skills, and explanations
- Admin management APIs

## Documentation

- Backend setup and behavior: [`backend/README.md`](backend/README.md)
- AI Service setup and behavior: [`ai-service/README.md`](ai-service/README.md)
- API contract: [`docs/api-contract.md`](docs/api-contract.md)
- Postman regression notes: [`docs/postman-regression.md`](docs/postman-regression.md)
- Performance tooling: [`performance/README.md`](performance/README.md)
- Contributor and agent rules: [`AGENTS.md`](AGENTS.md)

## Current MVP Limitations

- No OCR for image-only CVs
- No embeddings or vector database
- No asynchronous processing queue
- No production internal authentication between services
- No immutable historical snapshot of the source CV/job corpus
- No concurrent reanalysis attempt guard
- No manual extracted-text editing
- Frontend source and frontend CI are not present in this repository
