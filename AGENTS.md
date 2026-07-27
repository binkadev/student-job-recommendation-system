# AGENTS.md

## Project

Student Job Recommendation System for IT students using Content-Based Filtering, bilingual English/Vietnamese CV processing, TF-IDF, Cosine Similarity, and canonical skill matching.

## Source of truth

- The canonical integration branch is `master`.
- New work starts from the latest `master` and returns through a reviewed pull request.
- Do not use personal or legacy branches such as `THI`, `Bao_RECOMMENDATION_Error`, or `Bao_RECOMMENDATION_v2` as sources of domain behavior.
- Historical changes may be consulted only after comparison with current contracts, migrations, and tests.

## Current repository scope

The verified `master` branch contains:

- Spring Boot Backend under `backend/`;
- stateless bilingual FastAPI AI Service under `ai-service/`;
- PostgreSQL Flyway migrations V1–V15;
- Backend and AI automated tests;
- Backend and AI GitHub Actions workflows;
- database, API, ERD, regression, and performance documentation;
- PostgreSQL-only local Docker Compose infrastructure.

The current `master` branch does not contain a buildable frontend package manifest and lockfile. Do not claim completed frontend integration or frontend CI until reviewed frontend source is merged and verified end to end.

## Architecture responsibilities

### Backend

The Spring Boot backend is the system of record. It owns:

- JWT authentication and role authorization;
- student, company, job, application, CV, notification, and saved-item rules;
- PostgreSQL persistence and Flyway migrations;
- CV/application ownership checks;
- eligible-job filtering;
- AI request orchestration and response validation;
- transaction boundaries;
- recommendation run state, deterministic ranking, and persistence;
- public API response and error contracts.

### AI Service

The FastAPI AI Service is stateless computation. It owns:

- PDF/DOCX text extraction;
- English/Vietnamese language detection;
- deterministic English/Vietnamese preprocessing;
- canonical skill extraction and alias mapping;
- same-language TF-IDF and Cosine Similarity;
- cross-language canonical-skill matching;
- deterministic explanations.

The AI Service must not receive user JWTs, access the application database, persist recommendation runs, or own public rank positions.

## Current AI Contract

Backend uses Contract V2:

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

V1 remains only for compatibility and regression coverage.

Current metadata:

- algorithm: `tfidf-cosine-hybrid`;
- algorithm version: `bilingual-recommendation-v2`;
- processing version: `bilingual-nlp-v2-skills-v1`.

Health metadata:

- `/health`: legacy-compatible liveness response;
- `/health/v2`: current bilingual deployment metadata.

Strategies:

- English ↔ English: `SAME_LANGUAGE_HYBRID`;
- Vietnamese ↔ Vietnamese: `SAME_LANGUAGE_HYBRID`;
- cross-language, mixed, or insufficient confidence: `CROSS_LANGUAGE_SKILL_BASED`.

Scoring:

```text
same language + job skills:
score = 0.65 * textScore + 0.35 * skillScore

same language + no job skills:
score = textScore

cross language / insufficient confidence:
textScore = null
score = skillScore
```

AI returns no rank. Backend validates scores and threshold, sorts by `score DESC` then `jobId ASC`, assigns continuous `rankPosition`, and persists results.

Production V2 code uses `recommend_bilingual`. Any remaining `recommend_english` symbol is a deprecated compatibility alias, not product metadata or the current algorithm name.

## Technology

### Backend

- Java 21
- Spring Boot 3.5.x
- Maven
- PostgreSQL 17
- Spring Data JPA / Hibernate
- Spring Security + JWT
- Flyway
- Swagger/OpenAPI
- Testcontainers

### AI Service

- Python 3.11
- FastAPI
- Pydantic V2
- scikit-learn
- underthesea
- pdfplumber
- python-docx
- pytest

## General rules

1. Do not change unrelated modules.
2. Do not add dependencies without a clear purpose and locked version where required.
3. Never edit a released Flyway migration; add a new migration.
4. Do not use `ddl-auto=create` or `create-drop` in committed runtime configuration.
5. Never expose password hashes, storage paths, stored filenames, credentials, or private user data.
6. Protected business data uses status transitions unless deletion is explicitly allowed.
7. JSON APIs use `ApiResponse<T>` except successful raw CV file streams.
8. Request DTOs use Jakarta validation where appropriate.
9. Company operations remain scoped to the authenticated company.
10. Student operations remain scoped to the authenticated student.
11. A student cannot apply to the same job twice.
12. Saved Candidate uniqueness is `company_id + student_id`; `application_id` records only the source application.
13. Only one CV may be active for a student.
14. Recommendations use only the selected CV's persisted `READY` analysis.
15. External AI calls must not hold a database transaction open.
16. Backend rejects malformed or semantically invalid AI responses before persistence.
17. Keep V1 compatibility isolated from V2 behavior.
18. Keep documentation synchronized with executable behavior.
19. Do not claim full-stack Docker Compose: current Compose runs PostgreSQL only.
20. Do not claim frontend build/CI until package manifest, lockfile, scripts, and workflow exist on `master`.

## CORS

CORS origins are configured through:

```text
APP_CORS_ALLOWED_ORIGINS
APP_CORS_ALLOW_CREDENTIALS
```

Defaults cover local development only. Origins are trimmed and de-duplicated. Do not use wildcard origin with credentials. Do not hard-code production domains in Java source.

## Database rules

- PostgreSQL is required.
- Current schema is Flyway V1–V15.
- BIGSERIAL identifiers and VARCHAR-backed enums remain unless a reviewed design changes them.
- Important uniqueness rules include:
  - `users.email`;
  - `students.user_id`;
  - `companies.user_id`;
  - `student_profiles.student_id`;
  - `applications(student_id, job_id)`;
  - `saved_jobs(student_id, job_id)`;
  - `saved_candidates(company_id, student_id)`;
  - `student_skills(student_id, skill_id)`;
  - `job_skills(job_id, skill_id)`;
  - case-insensitive saved-search name per student;
  - one active CV per student through a partial unique index.
- `notifications.reference_type/reference_id` is polymorphic and intentionally has no physical FK for `reference_id`.
- AI Service has no database tables and no database access.

## Verification

Backend:

```bash
cd backend
./mvnw -B -ntp test
./mvnw -B -ntp clean verify
```

AI Service:

```bash
cd ai-service
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m pytest
```

GitHub Actions:

- `.github/workflows/backend-ci.yml` validates Backend changes;
- `.github/workflows/ai-ci.yml` validates AI Service changes.

Frontend verification is a remaining gap until a buildable frontend package is merged into `master`.

Before finishing, verify:

- no unrelated changes;
- no broken imports;
- no missing migration;
- no secret/local environment file committed;
- no stale English-only metadata for bilingual V2;
- documentation matches current contracts and limitations;
- Docker Compose scope is described accurately.

## Current limitations

- no OCR;
- no embeddings or vector database;
- no asynchronous queue;
- no production service-to-service authentication;
- no immutable historical recommendation input snapshot;
- no concurrent reanalysis guard;
- no manual extracted-text editing;
- no job-skill importance/minimum-level inputs in V2 scoring;
- no full-stack Docker Compose;
- no verified frontend package/CI on `master`.
