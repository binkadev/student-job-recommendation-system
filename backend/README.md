# Backend

Spring Boot backend for the Student Job Recommendation System.

## Requirements

- Java 21
- Docker Desktop or Docker Engine with Compose

## Run Database

From the repository root:

```powershell
docker compose up -d postgres
```

PostgreSQL runs on `localhost:5432` with:

- Database: `student_job_recommendation`
- Username: `postgres`
- Password: `123456`

These are the committed development defaults. Override them without editing source by setting environment variables:

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

## Run Backend

From the `backend` folder with the dev profile:

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

For Git Bash, macOS, or Linux:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

The `dev` profile runs the local demo seeder. It creates missing demo users, profiles, skills, jobs, and job skills without duplicating them on restart. Existing demo user passwords, roles, and statuses are not reset.

## CV File Storage

CV uploads and downloads resolve files only inside the backend-owned storage directory. The default is `uploads/cvs` relative to the backend working directory. Override it without editing source:

```powershell
$env:APP_CV_UPLOAD_DIR="C:\path\to\private\cv-storage"
```

CV file endpoints preview inline by default. Add `?download=true` to request an attachment. Successful file responses stream raw bytes; JSON error responses retain the common API envelope. Internal storage paths and stored filenames are never returned.

## CV Analysis and Recommendation Integration

Spring Boot is the system of record. It owns JWT and role checks, CV/student ownership, PostgreSQL and Flyway access, eligible-job filtering, transaction boundaries, recommendation run state, result persistence, and public API errors. The separate AI service is stateless computation; it receives neither a user's JWT nor database credentials and must not read or write the Spring Boot database.

Configure the synchronous AI client with environment variables:

```powershell
$env:APP_AI_SERVICE_BASE_URL="http://localhost:8000"
$env:APP_AI_SERVICE_CONNECT_TIMEOUT="2s"
$env:APP_AI_SERVICE_READ_TIMEOUT="15s"
```

These values are optional; the shown values are the safe local defaults. Start the local AI service on port `8000`, then run Spring Boot normally with the `dev` profile. The backend calls:

- `POST /internal/v1/cv/parse` as multipart form data with field `file`.
- `POST /internal/v1/recommendations` as typed JSON containing one CV and the backend-filtered eligible job corpus.

Public student endpoints:

- `GET /api/students/me/cv/{cvId}/analysis`
- `PATCH /api/students/me/cv/{cvId}/extracted-data`
- `POST /api/students/me/cv/{cvId}/reanalyze`
- `POST /api/students/me/recommendations/generate`
- `GET /api/students/me/recommendation-runs/{runId}`

Generation commits `PROCESSING`, waits for external computation without an open database transaction, then commits `SUCCESS` plus results or `FAILED` plus a sanitized message. Only `ACTIVE` jobs for `VERIFIED` companies with null, current, or future deadlines are submitted. Scores are validated from `0.0` through `1.0`.

The existing skill schema has a source but no CV reference, so reanalysis preserves all current student skills and does not persist parser skill candidates. Historical recommendation runs retain the CV foreign key but not an immutable snapshot of CV text, skills, job documents, algorithm metadata, missing skills, or reasons.

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

Use `POST /api/auth/login` with a demo account to get a JWT. Click `Authorize` in Swagger, enter the token as `Bearer <token>`, then test protected APIs.

## Tests

Run the fast smoke and unit-test layer without Docker or PostgreSQL:

```powershell
.\mvnw.cmd -B -ntp test
```

Run the complete test lifecycle, including PostgreSQL integration tests:

```powershell
.\mvnw.cmd -B -ntp clean verify
```

The integration-test layer requires a working Docker environment. Maven Failsafe starts a PostgreSQL 17 Testcontainer with dynamically assigned connection details, applies Flyway migrations, and validates the Hibernate mappings. It does not use the local development database or its credentials.

AI client unit tests use an in-process local HTTP stub and never contact a real AI service. PostgreSQL API integration tests point the Spring client at another in-process stub, covering successful and failed parsing and recommendation orchestration without an external Python process.

## Phase 1 FE API Gaps

Additional backend endpoints for frontend integration:

- Public: `GET /api/public/companies`, `GET /api/public/companies/{id}`
- Public jobs: `GET /api/public/jobs`, `GET /api/public/jobs/{jobId}`
- Admin users: `GET /api/admin/users`, `GET /api/admin/users/{id}`, `PATCH /api/admin/users/{id}/status`
- Admin companies: `GET /api/admin/companies`, `GET /api/admin/companies/{id}`, `PATCH /api/admin/companies/{id}/status`
- Company applications: `GET /api/companies/me/applications`, `GET /api/companies/me/applications/{id}`
- Company application CV: `GET /api/companies/me/applications/{applicationId}/cv/file`
- Recruiter saved candidates: `GET`, `POST /api/companies/me/saved-candidates`, `DELETE /api/companies/me/saved-candidates/{id}`
- Notification settings: `GET`, `PUT /api/users/me/notification-settings`
- Student saved searches: `GET`, `POST /api/students/me/saved-searches`, `PUT`, `DELETE /api/students/me/saved-searches/{savedSearchId}`
- Password change: `PATCH /api/users/me/password`
- Admin applications: `GET /api/admin/applications`, `GET /api/admin/applications/{applicationId}`
- Student details: `GET /api/students/me/applications/{id}`, `GET /api/students/me/cv/{id}`, `PATCH /api/students/me/cv/{id}/active`
- Student CV files: `GET /api/students/me/cv/{cvId}/file`, `DELETE /api/students/me/cv/{cvId}`
- CV analysis: `GET /api/students/me/cv/{cvId}/analysis`, `PATCH /api/students/me/cv/{cvId}/extracted-data`, `POST /api/students/me/cv/{cvId}/reanalyze`
- Recommendations: `POST /api/students/me/recommendations/generate`, `GET /api/students/me/recommendation-runs/{runId}`

See `../docs/api-contract.md` for request parameters, response fields, enum values, and privacy constraints.
