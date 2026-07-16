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
