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

## Phase 1 FE API Gaps

Additional backend endpoints for frontend integration:

- Public: `GET /api/public/companies`, `GET /api/public/companies/{id}`
- Admin users: `GET /api/admin/users`, `GET /api/admin/users/{id}`, `PATCH /api/admin/users/{id}/status`
- Admin companies: `GET /api/admin/companies`, `GET /api/admin/companies/{id}`, `PATCH /api/admin/companies/{id}/status`
- Company applications: `GET /api/companies/me/applications`, `GET /api/companies/me/applications/{id}`
- Company application CV: `GET /api/companies/me/applications/{applicationId}/cv/file`
- Recruiter saved candidates: `GET`, `POST /api/companies/me/saved-candidates`, `DELETE /api/companies/me/saved-candidates/{id}`
- Notification settings: `GET`, `PUT /api/users/me/notification-settings`
- Admin applications: `GET /api/admin/applications`, `GET /api/admin/applications/{applicationId}`
- Student details: `GET /api/students/me/applications/{id}`, `GET /api/students/me/cv/{id}`, `PATCH /api/students/me/cv/{id}/active`
- Student CV files: `GET /api/students/me/cv/{cvId}/file`, `DELETE /api/students/me/cv/{cvId}`

See `../docs/api-contract.md` for request parameters, response fields, enum values, and privacy constraints.
