# Operations Guide

## Current deployment model

The repository is not a fully containerized stack.

| Component | Current local execution |
|---|---|
| PostgreSQL 17 | Root `docker-compose.yml` |
| Spring Boot Backend | Maven / Java process |
| FastAPI AI Service | Python / Uvicorn process |
| Frontend | No buildable package on `master` |

A full-stack Docker Compose file remains future work.

## Local startup order

1. PostgreSQL:

   ```powershell
   docker compose up -d postgres
   ```

2. AI Service:

   ```powershell
   cd ai-service
   python -m pip install --require-hashes -r requirements.lock
   python -m pip check
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

3. Backend:

   ```powershell
   cd backend
   .\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
   ```

## Health checks

AI legacy-compatible liveness:

```http
GET http://localhost:8000/health
```

AI current bilingual metadata:

```http
GET http://localhost:8000/health/v2
```

Backend health is currently verified through application startup, Swagger/API requests, and automated tests; a dedicated Actuator health contract is not part of the current MVP.

## CORS

Backend CORS is environment-configurable:

```text
APP_CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
APP_CORS_ALLOW_CREDENTIALS=false
```

LAN/domain example:

```powershell
$env:APP_CORS_ALLOWED_ORIGINS="http://192.168.1.10:5173,https://demo.example.com"
```

Rules:

- origins are trimmed and de-duplicated;
- blank lists are rejected;
- wildcard `*` is rejected when credentials are enabled;
- Bearer JWT is used, so credentials are disabled by default;
- production origins must be provided through environment configuration, not hard-coded in Java.

## CI matrix

| Workflow | Scope | Commands |
|---|---|---|
| `backend-ci.yml` | `backend/**` | Maven `clean verify` with Java 21 |
| `ai-ci.yml` | `ai-service/**` | locked install, `pip check`, `pytest` with Python 3.11 |
| Frontend CI | Not available | blocked until a buildable frontend package and lockfile are merged |

## Contract deployment order

For an incompatible future Backend ↔ AI internal contract revision:

1. add the new AI contract while retaining the old contract;
2. deploy AI first;
3. verify the current health metadata and contract fixtures;
4. deploy Backend;
5. run end-to-end regression;
6. remove old compatibility behavior only in a later reviewed change.

## Production gaps

Before a public production deployment, address:

- service-to-service authentication and private networking for AI;
- secret management and JWT key rotation;
- TLS termination;
- production-only Swagger/OpenAPI policy;
- full-stack process/container orchestration;
- monitoring, structured logs, and alerting;
- database backup and recovery;
- concurrent CV reanalysis protection.
