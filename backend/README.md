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

- Database: `job_recommendation_db`
- Username: `postgres`
- Password: `postgres`

## Run Backend

From the `backend` folder with the dev profile:

```powershell
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

For Git Bash, macOS, or Linux:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

The `dev` profile runs the local demo seeder. It creates or updates demo records without duplicating them on restart.

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
