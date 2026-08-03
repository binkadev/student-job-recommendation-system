# Windows PowerShell Runbook

This runbook describes the current local stack. It is for development and
demonstration, not a production deployment procedure.

## Prerequisites

- Docker Desktop with Compose V2 and a running Linux engine.
- Java 21 for running Backend outside Compose.
- Python 3.11 for running AI Service outside Compose.
- Node.js 24 and npm for Frontend.
- PowerShell 5.1+ or PowerShell 7.

From the repository root:

```powershell
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

The template contains local placeholders. Existing local environment files must
not be overwritten. Replace placeholders for any shared environment and never
commit `.env`.

## Normal Docker Compose startup

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

The checked-in default maps PostgreSQL to 127.0.0.1:5432. A local .env override
may change that host port; in the verification environment it was 55432.
Normal service mappings are:

| Service | URL or port |
|---|---|
| PostgreSQL | `127.0.0.1:5432` |
| Backend | `http://127.0.0.1:8080` |
| AI health | `http://127.0.0.1:8000/health` |
| AI OpenAPI | `http://127.0.0.1:8000/docs` |
| Backend Swagger | `http://127.0.0.1:8080/swagger-ui.html` |
| Frontend dev server | `http://localhost:5173` |

Health checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/api/public/statistics
docker compose ps
```

## Frontend

In a second PowerShell window:

```powershell
Set-Location frontend
npm.cmd ci
if (-not (Test-Path .env.local)) {
    Copy-Item .env.example .env.local
}
npm.cmd run dev
```

The Vite proxy sends `/api` to `http://127.0.0.1:8080`.

## Backend without Compose

Start PostgreSQL and AI Service first, then from `backend/`:

```powershell
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:<POSTGRES_PORT>/student_job_recommendation"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "<same as POSTGRES_PASSWORD>"
$env:APP_AI_SERVICE_BASE_URL = "http://127.0.0.1:8000"
$env:APP_AI_SERVICE_INTERNAL_API_KEY = "<same as AI_INTERNAL_API_KEY>"
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
`SPRING_DATASOURCE_PASSWORD`, `APP_AI_SERVICE_BASE_URL`, and
`APP_AI_SERVICE_INTERNAL_API_KEY` when local defaults are insufficient. The
`<POSTGRES_PORT>` must match the effective root .env value: 5432 by default or
55432 in the recorded verification environment. The Backend and AI internal
keys must be identical. Do not print a real password or secret. Backend listens
on port 8080 unless SERVER_PORT is set.

## AI Service without Compose

From `ai-service/`:

```powershell
python -m venv .venv
$Python = ".\.venv\Scripts\python.exe"
& $Python -m pip install --require-hashes --only-binary=:all: -r requirements.lock
& $Python -m pip check
$env:AI_INTERNAL_API_KEY = "<shared local key>"
& $Python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

The Backend must use the same internal key. The AI Service does not connect to
PostgreSQL.

## Shutdown and cleanup

Normal stack, preserving named volumes:

```powershell
docker compose down
```

Normal stack including local database and CV volumes:

```powershell
docker compose down --volumes --remove-orphans
```

Use the second command only when losing local demo data is intended.

## Recovery commands

```powershell
docker compose ps -a
docker compose logs --no-color --tail 200 backend
docker compose logs --no-color --tail 200 ai-service
docker compose logs --no-color --tail 200 postgres
docker compose up --build -d postgres ai-service backend
```

If a port is occupied, set `POSTGRES_PORT`, `AI_PORT`, or
`BACKEND_PORT` in `.env` and restart the normal project. Do not change the
isolated E2E ports.

## Real Candidate Ranking E2E

From the repository root, with Docker Desktop running:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-candidate-ranking-real-e2e.ps1
```

The runner uses Compose project `candidate-ranking-real-e2e`, ports 15432,
18000, and 18080, and dedicated volumes. It seeds a disposable fixture,
checks registration/login, Candidate Ranking POST, history/detail GET, real AI
scoring, persistence, deterministic results, and exactly one AI bulk request.
It removes the isolated project and volumes on exit. This E2E project is
isolated from the normal development Compose project; do not run it with
`-KeepE2EStack` unless debugging and clean it afterward.
