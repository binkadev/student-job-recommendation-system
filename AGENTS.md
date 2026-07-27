# AGENTS.md

## Project

Student Job Recommendation System for IT students using Content-Based Filtering, bilingual CV processing, TF-IDF, Cosine Similarity, and canonical skill matching.

## Source of Truth

- The canonical integration branch is `master`.
- New work must start from the latest `master` and return through a reviewed pull request.
- Do not use legacy branches such as `THI`, `Bao_RECOMMENDATION_Error`, `Bao_RECOMMENDATION_v2`, or similarly named personal branches as the source of domain behavior.
- A legacy branch may only be consulted for historical context, and every reused change must be reviewed against the current `master` contracts, migrations, and tests.

## Current Repository Scope

The repository currently contains:

- Frontend UI source under `frontend/`
- Spring Boot backend
- Stateless FastAPI AI Service
- PostgreSQL and Flyway migrations
- Backend and AI automated tests
- Performance tooling and benchmark evidence
- API and integration documentation

The frontend source was introduced as a mock-data UI without Backend integration. Do not claim that frontend flows are connected to the current Backend or AI contracts unless the claim is supported by current code and end-to-end runtime evidence.

## Current Architecture

### Backend responsibilities

The Spring Boot backend is the system of record. It owns:

- JWT authentication and role authorization
- Student, company, job, application, CV, notification, and saved-item business rules
- PostgreSQL persistence and Flyway migrations
- CV and application ownership checks
- Eligible-job filtering
- AI request orchestration and response validation
- Transaction boundaries
- Recommendation run state, ranking, and persistence
- Public API response and error contracts

### AI Service responsibilities

The FastAPI AI Service is stateless computation. It owns:

- PDF and DOCX text extraction
- English and Vietnamese language detection
- Deterministic English and Vietnamese preprocessing
- Canonical skill extraction and alias mapping
- Same-language TF-IDF and Cosine Similarity
- Cross-language skill-only matching
- Deterministic recommendation explanations

The AI Service must not receive user JWTs, access the application database, or own public ranking persistence.

## Current AI Contract

Backend uses Contract V2:

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`

V1 remains available only for compatibility and regression coverage.

Current metadata:

- Algorithm: `tfidf-cosine-hybrid`
- Algorithm version: `bilingual-recommendation-v2`
- Processing version: `bilingual-nlp-v2-skills-v1`

Supported recommendation strategies:

- English CV to English Job: `SAME_LANGUAGE_HYBRID`
- Vietnamese CV to Vietnamese Job: `SAME_LANGUAGE_HYBRID`
- English CV to Vietnamese Job: `CROSS_LANGUAGE_SKILL_BASED`
- Vietnamese CV to English Job: `CROSS_LANGUAGE_SKILL_BASED`
- Mixed or insufficient-confidence pairs: `CROSS_LANGUAGE_SKILL_BASED`

For same-language jobs with declared skills:

- `score = 0.65 * textScore + 0.35 * skillScore`

For same-language jobs without declared skills:

- `score = textScore`

For cross-language or insufficient-confidence pairs:

- `textScore = null`
- `score = skillScore`

AI returns no `rank` or `rankPosition`. Backend validates scores, sorts by `score DESC` then `jobId ASC`, assigns continuous `rankPosition`, and persists the results.

## Tech Stack

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

## Backend Package

Base package:

```text
com.tttn.jobrecommendation
```

Backend source root:

```text
backend/src/main/java/com/tttn/jobrecommendation
```

Modules follow the existing structure:

- `controller/`
- `service/`
- `service/impl/` or a `ServiceImpl` class
- `repository/`
- `entity/`
- `dto/request/`
- `dto/response/`
- `mapper/`

Do not rename established packages or move modules without an explicit architecture decision.

## General Rules

1. Do not change unrelated modules.
2. Do not introduce a dependency without explaining its purpose and locking its version where required.
3. Do not modify an already released Flyway migration. Add a new migration.
4. Do not use Hibernate `ddl-auto=create` or `create-drop` in committed runtime configuration.
5. Do not expose password hashes, internal storage paths, stored filenames, or private user data.
6. Do not hard-delete protected business data unless the established domain explicitly allows deletion.
7. All JSON APIs use `ApiResponse<T>` except successful raw CV file streaming responses.
8. All request DTOs use Jakarta validation where appropriate.
9. Company operations must remain scoped to the authenticated company.
10. Student operations must remain scoped to the authenticated student.
11. A student cannot apply to the same job twice.
12. Saved Candidate uniqueness is `company_id + student_id`; `application_id` records the source application and does not redefine the domain as Saved Application.
13. Only one CV may be active for a student.
14. Recommendation generation may use only the selected CV's persisted READY analysis snapshot.
15. External AI calls must not run while holding a database transaction open.
16. Backend must reject malformed or semantically invalid AI responses before persistence.
17. Keep V1 compatibility behavior isolated from V2 behavior.
18. Keep documentation synchronized with executable behavior.
19. Treat the current frontend as mock-data UI until API integration is verified end to end.

## API Response Format

Success:

```json
{
  "success": true,
  "message": "Success",
  "errorCode": null,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Error message",
  "errorCode": "ERROR_CODE",
  "data": null
}
```

Pagination data:

```json
{
  "items": [],
  "page": 1,
  "size": 10,
  "totalItems": 100,
  "totalPages": 10
}
```

Page numbers are 1-based in public API responses.

## Security Rules

Public endpoints include:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/public/companies/**`
- `GET /api/public/jobs/**`
- `GET /api/public/statistics`
- `/swagger-ui/**`
- `/v3/api-docs/**`

All other public backend APIs require authentication unless explicitly documented.

Roles:

- `STUDENT`: manage own profile, skills, CVs, saved jobs, saved searches, applications, notifications, and recommendations
- `COMPANY`: manage own company profile, jobs, applications, saved candidates, and notification settings
- `ADMIN`: manage system users, companies, jobs, applications, and skills according to existing endpoint rules

## Database Rules

- Use PostgreSQL.
- Use existing BIGSERIAL identifiers and VARCHAR-backed enums unless a new reviewed design changes them.
- Business tables use `created_at` and `updated_at` where established.
- Use status transitions instead of destructive deletion for protected business records.
- Add indexes for verified query patterns, not speculatively.
- Preserve established unique constraints, including:
  - `users.email`
  - `students.user_id`
  - `companies.user_id`
  - `student_profiles.student_id`
  - `applications(student_id, job_id)`
  - `saved_jobs(student_id, job_id)`
  - `saved_candidates(company_id, student_id)`
  - `student_skills(student_id, skill_id)`
  - `job_skills(job_id, skill_id)`

## Verification Before Finishing

Backend fast tests:

```bash
cd backend
./mvnw -B -ntp test
```

Backend full PostgreSQL integration lifecycle:

```bash
cd backend
./mvnw -B -ntp clean verify
```

AI Service environment and tests:

```bash
cd ai-service
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m pytest
```

Also verify:

- no unrelated file changes
- no broken imports
- no missing migration
- no secret or local environment file committed
- no stale English-only product metadata for bilingual V2 behavior
- documentation matches the current contract and limitations
- frontend integration claims are supported by current runtime evidence
