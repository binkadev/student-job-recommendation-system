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

## Swagger

Swagger UI placeholder:

```text
http://localhost:8080/swagger-ui.html
```
