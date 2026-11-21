# Setup and Run Guide — Student Job Recommendation System

A complete, codebase-verified installation, configuration, startup, and testing guide for running the **Student Job Recommendation System (`JobRecommend`)** on **Windows (PowerShell)** and **macOS / Linux (Bash)**.

---

## Table of Contents

1. [Project & Architecture Overview](#1-project--architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Variables & Secrets Configuration](#3-environment-variables--secrets-configuration)
4. [Option A: Quick Start with Docker Compose (Recommended)](#4-option-a-quick-start-with-docker-compose-recommended)
5. [Option B: Manual Local Development Setup (Without Docker)](#5-option-b-manual-local-development-setup-without-docker)
6. [Database Setup, Migrations & Initial Accounts](#6-database-setup-migrations--initial-accounts)
7. [Verification & Running Tests](#7-verification--running-tests)
8. [Troubleshooting & Common Issues](#8-troubleshooting--common-issues)
9. [Configuration Notes & Caveats](#9-configuration-notes--caveats)

---

## 1. Project & Architecture Overview

The **Student Job Recommendation System** is an English-NLP IT recruitment and Content-Based Filtering platform connecting **Students (`STUDENT`)**, **Companies (`COMPANY`)**, and **Administrators (`ADMIN`)**.

```text
+------------------------------+      REST JSON + JWT       +-------------------------------------+
|  Frontend SPA                | <------------------------> |  Backend (System of Record)         |
|  React 18 + TS + Vite        |   /api proxy -> :8080      |  Spring Boot 3.5.16 / Java 21       |
|  Tailwind CSS + GSAP         |                            |  Security, RBAC, Flyway, Persistence|
+------------------------------+                            +------------------+------------------+
                                                                               | Internal HTTP
                                                                               | Header: X-Internal-Api-Key
                                                                               v
+------------------------------+      JDBC / JPA (:5432)    +-------------------------------------+
|  PostgreSQL 17               | <------------------------> |  Stateless AI Service (:8000)       |
|  Flyway Migrations V1..V25   |                            |  FastAPI 0.139.2 / Python 3.11.9    |
|  Named Volume: postgres_data |                            |  PDF/DOCX, 3-Stage spaCy NLP, Global IDF |
+------------------------------+                            +-------------------------------------+
```

- **Frontend (`frontend/`)** communicates **only** with the Backend via `/api` (proxied by Vite dev server to `http://127.0.0.1:8080`). It never calls the AI Service directly.
- **Backend (`backend/`)** is the sole system of record owning authentication (JWT), RBAC, PostgreSQL persistence, Flyway migrations, file storage, AI orchestration, response validation, official rank assignment, and audit history.
- **AI Service (`ai-service/`)** is a stateless FastAPI microservice for PDF/DOCX extraction, English-only 3-stage spaCy NLP (`Regex Denoising` → offline-compiled `EntityRuler` merging → `NER/POS` filtering), canonical IT skill normalization, and Global-IDF TF-IDF + Cosine Similarity scoring (`.transform()` only from `tfidf_model.pkl`). It has no database access (`psycopg` is isolated strictly in the offline `trainer` stage) and never accepts user JWTs.

### Service Summary Table

| Service Name | Directory | Tech Stack & Exact Pinned Versions | Default Port | Dependencies |
| :--- | :--- | :--- | :---: | :--- |
| **PostgreSQL Database** | *(Docker image / local)* | PostgreSQL `17` (`postgres:17`), Flyway migrations `V1`–`V25` | `5432` | None |
| **AI Service** | `ai-service/` | Python `3.11.9` (`python:3.11.9-slim-bookworm`), FastAPI `0.139.2`, Uvicorn `0.51.0`, Pydantic `2.13.4`, `spacy` `3.8.18` + `en_core_web_sm` `3.8.0`, `scikit-learn` `1.9.0`, `numpy` `2.4.6`, `pdfplumber` `0.11.10`, `python-docx` `1.2.0` | `8000` | None (stateless; offline `ai-trainer` uses `psycopg` `3.3.9`) |
| **Backend API** | `backend/` | Java `21` (`eclipse-temurin:21`), Spring Boot `3.5.16`, Maven `3.9.16` (via Wrapper `3.3.4`), `jjwt` `0.13.0`, `springdoc-openapi` `2.8.17`, Flyway + PostgreSQL driver | `8080` | PostgreSQL `17`, AI Service |
| **Frontend SPA** | `frontend/` | Node.js `24` (CI/runbook), React `18.3.1`, TypeScript `~5.6.3`, Vite `6.4.6`, Tailwind CSS `3.4.17`, Axios `1.20.0`, React Router `7.18.5`, GSAP `3.15.0`, Vitest `4.1.12` | `5173` | Backend API |
| **E2E Test Suite** *(optional)* | `e2e/` | Playwright Test `1.56.1`, `@axe-core/playwright` `4.10.2` (Chromium) | *(Runner uses `5175`/random)* | Running stack or Docker Testcontainers |

---

## 2. Prerequisites

Install only what you need for your chosen setup path:

| Tool / Runtime | Exact Version Required | Used By | Notes |
| :--- | :--- | :--- | :--- |
| **Docker Desktop / Docker Engine** + **Compose V2** | Latest with Compose V2 (`docker compose`) | Option A (Docker), Backend Testcontainers ITs, E2E scripts | Must run **Linux containers** on Windows. |
| **Node.js & npm** | **Node.js `24.x`** (CI & runbook; README notes `20+`) | Frontend (`frontend/`), E2E (`e2e/`) | `frontend/package.json` uses `package-lock.json` (`npm ci`). |
| **Java JDK** | **JDK `21`** (e.g., Eclipse Temurin 21 / Microsoft OpenJDK 21) | Option B (Backend), Backend unit/IT tests, isolated E2E runners | Required on `PATH` and `JAVA_HOME`. |
| **Maven** | **Not required globally** (`3.9.16` auto-managed) | Backend (`backend/`) | Use included Maven Wrapper (`mvnw` / `mvnw.cmd`, wrapper `3.3.4`). |
| **Python** | **Python `3.11.9`** (strictly `3.11.x`) | Option B (AI Service) | **Do not use Python 3.12+** — `requirements.lock` pins `numpy==2.4.6` with CPython 3.11 binary wheel hashes. |
| **PostgreSQL** | **PostgreSQL `17`** | Option B (only if running DB without Docker) | Can alternatively run just `postgres:17` via Docker. |
| **PowerShell** | PowerShell `5.1+` or PowerShell `7` (`pwsh`) | Automation scripts in `scripts/*.ps1` | Cross-platform `pwsh` is also used by GitHub Actions on Ubuntu. |

### Verify Installed Versions

**Windows (PowerShell):**
```powershell
docker --version
docker compose version
node --version
npm --version
java -version
python --version
```

**macOS / Linux (Bash):**
```bash
docker --version
docker compose version
node --version
npm --version
java -version
python3 --version
```

---

## 3. Environment Variables & Secrets Configuration

### Complete Environment Variables Reference

#### A. Root Docker Compose & PostgreSQL (`.env`)

| Variable Name | Service | Required / Optional | Default Value | Validation Rules / Constraints | Safe Example Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POSTGRES_DB` | Postgres, Backend | Optional | `student_job_recommendation` | Must match DB name; `smoke-core.ps1` expects `student_job_recommendation` | `student_job_recommendation` |
| `POSTGRES_USER` | Postgres, Backend | Optional | `postgres` | Must match DB user; `smoke-core.ps1` expects `postgres` | `postgres` |
| `POSTGRES_PASSWORD` | Postgres, Backend | **Required** (Compose) | *(none — fails if unset)* | Non-empty string; required by Compose interpolation `${POSTGRES_PASSWORD:?...}` | `local-dev-pg-pass-2026` |
| `POSTGRES_PORT` | Postgres (Compose) | Optional | `5432` | Valid unused TCP port on `127.0.0.1` | `5432` |
| `BACKEND_PORT` | Backend (Compose) | Optional | `8080` | Valid unused TCP port on `127.0.0.1` | `8080` |
| `AI_PORT` | AI Service (Compose) | Optional | `8000` | Valid unused TCP port on `127.0.0.1` | `8000` |
| `JAVA_OPTS` | Backend (Compose) | Optional | `-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError` | Valid JVM flags | `-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError` |

#### B. AI Service (`ai-service/`)

| Variable Name | Service | Required / Optional | Default Value | Validation Rules / Constraints | Safe Example Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AI_INTERNAL_API_KEY` | AI Service | **Required** | *(none — fails fast at startup)* | **Mandatory.** Must be **at least 32 characters**, non-blank, **no leading/trailing whitespace**. Must match Backend's `APP_AI_SERVICE_INTERNAL_API_KEY`. | `local-dev-internal-api-key-minimum-32-chars-ok` |
| `AI_CV_MAX_FILE_SIZE_BYTES` | AI Service | Optional | `10485760` (10 MiB) | Strict positive decimal integer (`[1-9][0-9]*`); fails fast with `ConfigurationError` otherwise | `10485760` |
| `AI_CANDIDATE_RANKING_MAX_CANDIDATES` | AI Service | Optional | `500` | Strict positive decimal integer (`[1-9][0-9]*`); fails fast if invalid | `500` |
| `AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES` | AI Service | Optional | `8388608` (8 MiB) | Strict positive decimal integer (`[1-9][0-9]*`); fails fast if invalid | `8388608` |

#### C. Backend API (`backend/`)

| Variable Name | Service | Required / Optional | Default Value | Validation Rules / Constraints | Safe Example Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SPRING_PROFILES_ACTIVE` | Backend | Optional (Docker sets `dev`) | *(default Spring profile)* | `dev` enables `DataSeeder` & SQL logging; `prod` disables Swagger UI and requires all secrets; `e2e` disables `DataSeeder` | `dev` |
| `SERVER_PORT` | Backend | Optional | `8080` | Valid TCP port | `8080` |
| `SPRING_DATASOURCE_URL` | Backend | Optional in `dev` / **Required** in `prod` | `jdbc:postgresql://localhost:5432/student_job_recommendation` (`dev`) | Valid PostgreSQL JDBC URL | `jdbc:postgresql://127.0.0.1:5432/student_job_recommendation` |
| `SPRING_DATASOURCE_USERNAME` | Backend | Optional in `dev` / **Required** in `prod` | `postgres` (`dev`) | PostgreSQL username | `postgres` |
| `SPRING_DATASOURCE_PASSWORD` | Backend | **Required** (`dev` & `prod`) | *(none in `application-dev.yml` or `application-prod.yml`)* | Must be set explicitly when running `dev` or `prod` profiles | `local-dev-pg-pass-2026` |
| `SPRING_JPA_SHOW_SQL` | Backend | Optional | `true` (`dev`) / `false` (`prod` & Compose) | Boolean (`true`/`false`) | `false` |
| `APP_JWT_SECRET` | Backend | Optional in `dev` / **Required** in `prod` | `change-this-development-secret-key-before-production-use` (`application.yml`) | **At least 32 UTF-8 bytes** for HMAC-SHA256 (`jjwt 0.13.0`); `.env.example` recommends >= 64 chars. Shorter values fail at login with `WeakKeyException`. | `local-dev-jwt-secret-key-at-least-64-characters-long-replace-me-001` |
| `APP_JWT_EXPIRATION_MS` | Backend | Optional | `86400000` (24 hours) | Positive `long` (milliseconds) | `86400000` |
| `APP_CV_UPLOAD_DIR` | Backend | Optional in `dev` / **Required** in `prod` | `uploads/cvs` (Compose uses `/app/data/cvs`) | Writable directory; must **not** overlap `APP_COMPANY_VERIFICATION_STORAGE_DIR` | `uploads/cvs` |
| `APP_COMPANY_VERIFICATION_STORAGE_DIR` | Backend | Optional | `${user.home}/.sjrs/private/company-verification` | **Strict startup check (`CompanyVerificationDocumentStorage`):** MUST be an **absolute path**, **outside the Git repository**, and **must not overlap** `APP_CV_UPLOAD_DIR`. | `C:\Users\<you>\.sjrs\private\company-verification` or `/tmp/sjrs-verification` |
| `APP_CV_MAX_FILE_SIZE_BYTES` | Backend | Optional | `10485760` (10 MiB) | Positive integer (bytes); align with Spring multipart & AI Service limits | `10485760` |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | Backend | Optional | `10MB` | Spring `DataSize` (e.g., `10MB`) | `10MB` |
| `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | Backend | Optional | `10MB` | Spring `DataSize` (e.g., `10MB`) | `10MB` |
| `APP_AI_SERVICE_BASE_URL` | Backend | Optional in `dev` / **Required** in `prod` | `http://localhost:8000` (Compose uses `http://ai-service:8000`) | Valid HTTP base URL for AI Service | `http://127.0.0.1:8000` |
| `APP_AI_SERVICE_INTERNAL_API_KEY` | Backend | Optional in `dev` / **Required** in `prod` | `change-this-development-ai-internal-key-at-least-32-characters` (`application.yml`) | **Must exactly match AI Service's `AI_INTERNAL_API_KEY`** (Compose maps both from `AI_INTERNAL_API_KEY`). | `local-dev-internal-api-key-minimum-32-chars-ok` |
| `APP_AI_SERVICE_CONNECT_TIMEOUT` | Backend | Optional | `2s` | Spring `Duration` (e.g., `2s`) | `2s` |
| `APP_AI_SERVICE_READ_TIMEOUT` | Backend | Optional | `15s` | Spring `Duration` (e.g., `15s`) | `15s` |
| `APP_AI_CANDIDATE_RANKING_MAX_CANDIDATES_PER_REQUEST` | Backend | Optional in `dev` / **Required** in `prod` | `500` | `@Positive` integer | `500` |
| `APP_AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES` | Backend | Optional in `dev` / **Required** in `prod` | `8388608` (8 MiB) | `@Positive` long | `8388608` |

#### D. Frontend (`frontend/.env.local`)

| Variable Name | Service | Required / Optional | Default Value | Validation Rules / Constraints | Safe Example Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Frontend (Browser) | Optional | `/api` | Axios `baseURL` (`frontend/src/services/api/httpClient.ts`). Keep `/api` to use the Vite proxy and avoid CORS issues. | `/api` |
| `VITE_API_PROXY_TARGET` | Frontend (Vite Dev Server) | Optional | `http://127.0.0.1:8080` | Target URL for Vite `/api` reverse proxy (`frontend/vite.config.ts`). | `http://127.0.0.1:8080` |

---

### Creating Local `.env` Files & Generating Secure Secrets

1. **Copy the template files** from the repository root (never commit `.env` or `frontend/.env.local`):

**Windows (PowerShell):**
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path frontend\.env.local)) { Copy-Item frontend\.env.example frontend\.env.local }
```

**macOS / Linux (Bash):**
```bash
[ -f .env ] || cp .env.example .env
[ -f frontend/.env.local ] || cp frontend/.env.example frontend/.env.local
```

2. **(Optional for local dev, mandatory for any shared/staging environment) Generate strong random secrets:**

**Windows (PowerShell):**
```powershell
# Generate a 64-hex-char (32-byte) secret for AI_INTERNAL_API_KEY
-join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })

# Generate a 128-hex-char (64-byte) secret for APP_JWT_SECRET
-join ((1..64) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
```

**macOS / Linux (Bash):**
```bash
# Generate a 64-hex-char (32-byte) secret for AI_INTERNAL_API_KEY
openssl rand -hex 32

# Generate a 128-hex-char (64-byte) secret for APP_JWT_SECRET
openssl rand -hex 64
```

Open `.env` and replace `POSTGRES_PASSWORD`, `APP_JWT_SECRET`, and `AI_INTERNAL_API_KEY` if desired. Note that `.env.example`'s default placeholder values already satisfy all local startup length validators for immediate localhost testing.

---

## 4. Option A: Quick Start with Docker Compose (Recommended)

`docker-compose.yml` builds and starts the three core backend infrastructure services: **PostgreSQL 17**, **AI Service**, and **Backend API** (running under the `dev` profile with automatic Flyway migrations and demo seed data). The **Frontend** is not containerized in `docker-compose.yml` and runs locally via Vite.

### Step 1: Prepare Environment & Validate Compose Config

**Windows (PowerShell):**
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose config --quiet
```

**macOS / Linux (Bash):**
```bash
[ -f .env ] || cp .env.example .env
docker compose config --quiet
```

### Step 2: Build Images & Start Core Stack (`postgres`, `ai-service`, `backend`)

**Windows (PowerShell) & macOS / Linux (Bash):**
```bash
docker compose up --build -d
```

### Step 3: Monitor Startup & Verify Healthchecks

Wait until all three services report `healthy` (first build takes ~1–3 minutes while Maven downloads dependencies and builds the JAR):

```bash
docker compose ps
```

Inspect live logs if needed:
```bash
# All services
docker compose logs -f

# Or per service
docker compose logs --tail 100 postgres
docker compose logs --tail 100 ai-service
docker compose logs --tail 100 backend
```

### Step 4: Start the Frontend Dev Server

Open a **second terminal**:

**Windows (PowerShell):**
```powershell
Set-Location frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd ci
npm.cmd run dev
```

**macOS / Linux (Bash):**
```bash
cd frontend
[ -f .env.local ] || cp .env.example .env.local
npm ci
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Step 5: Stopping, Rebuilding, and Resetting Docker Stack

```bash
# Stop containers while PRESERVING PostgreSQL data and uploaded CVs
docker compose down

# Rebuild after backend or ai-service code changes
docker compose build --no-cache ai-service backend
docker compose up -d

# DESTRUCTIVE RESET: Stop containers and DELETE local database + CV volumes
docker compose down --volumes --remove-orphans
```

---

## 5. Option B: Manual Local Development Setup (Without Docker)

Start services strictly in dependency order: **PostgreSQL → AI Service → Backend → Frontend**.

---

### Step 1: PostgreSQL 17 (`127.0.0.1:5432`)

Ensure PostgreSQL 17 is running locally on port `5432` and create the `student_job_recommendation` database:

**Option 1 — Local PostgreSQL (`psql`):**
```bash
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE student_job_recommendation;"
```

**Option 2 — Lightweight Hybrid (PostgreSQL via Docker only):**
```bash
docker compose up -d postgres
```

---

### Step 2: AI Service (`ai-service/`, Port `8000`)

> **Local Model Compilation Note:** Before running `uvicorn` locally without Docker, compile the offline spaCy model (`python -m offline.build_spacy_model`) and bootstrap `tfidf_model.pkl` (`python -m offline.train_tfidf_incremental --bootstrap --force-rebuild`). Docker Compose runs both steps automatically during image build.

**Windows (PowerShell):**
```powershell
Set-Location ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install --require-hashes --only-binary=:all: -r requirements.lock
python -m pip check

# Required: >= 32 characters, no leading/trailing spaces
$env:AI_INTERNAL_API_KEY = "change-this-local-ai-internal-api-key-at-least-32-characters"
$env:AI_CV_MAX_FILE_SIZE_BYTES = "10485760"

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**macOS / Linux (Bash):**
```bash
cd ai-service
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --require-hashes --only-binary=:all: -r requirements.lock
python -m pip check

# Required: >= 32 characters, no leading/trailing spaces
export AI_INTERNAL_API_KEY="change-this-local-ai-internal-api-key-at-least-32-characters"
export AI_CV_MAX_FILE_SIZE_BYTES="10485760"

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Wait for `Application startup complete.` on `http://0.0.0.0:8000`.

---

### Step 3: Backend API (`backend/`, Port `8080`)

#### Local Storage Directories
- **CV Uploads (`APP_CV_UPLOAD_DIR`):** Defaults to `uploads/cvs` (relative to `backend/`). Auto-created on first upload.
- **Company Verification Documents (`APP_COMPANY_VERIFICATION_STORAGE_DIR`):** Defaults to `${user.home}/.sjrs/private/company-verification`. Auto-created on first upload. **Important:** If you override it, the path **must** be an absolute path outside the Git repository and must not overlap `APP_CV_UPLOAD_DIR`, or startup will fail immediately.

#### Start Backend (with `dev` profile)

Open a new terminal in `backend/`. Ensure `SPRING_DATASOURCE_PASSWORD` matches your PostgreSQL password and `APP_AI_SERVICE_INTERNAL_API_KEY` **exactly matches** Step 2's `AI_INTERNAL_API_KEY`:

**Windows (PowerShell):**
```powershell
Set-Location backend
$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:5432/student_job_recommendation"
$env:SPRING_DATASOURCE_USERNAME = "postgres"
$env:SPRING_DATASOURCE_PASSWORD = "change-this-local-postgres-password"
$env:APP_AI_SERVICE_BASE_URL = "http://127.0.0.1:8000"
$env:APP_AI_SERVICE_INTERNAL_API_KEY = "change-this-local-ai-internal-api-key-at-least-32-characters"

.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

**macOS / Linux (Bash):**
```bash
cd backend
chmod +x mvnw
export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5432/student_job_recommendation"
export SPRING_DATASOURCE_USERNAME="postgres"
export SPRING_DATASOURCE_PASSWORD="change-this-local-postgres-password"
export APP_AI_SERVICE_BASE_URL="http://127.0.0.1:8000"
export APP_AI_SERVICE_INTERNAL_API_KEY="change-this-local-ai-internal-api-key-at-least-32-characters"

./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Wait for `Started JobRecommendationApplication in ... seconds` on port `8080`. Flyway migrations `V1`–`V25` and `DataSeeder` run automatically during boot.

---

### Step 4: Frontend SPA (`frontend/`, Port `5173`)

Open a new terminal in `frontend/`:

**Windows (PowerShell):**
```powershell
Set-Location frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd ci
npm.cmd run dev
```

**macOS / Linux (Bash):**
```bash
cd frontend
[ -f .env.local ] || cp .env.example .env.local
npm ci
npm run dev
```

*(Optional LAN access: run `npm run dev:network`, which runs `vite --host 0.0.0.0`, and set `VITE_API_PROXY_TARGET` in `frontend/.env.local` if the Backend is on another host.)*

---

## 6. Database Setup, Migrations & Initial Accounts

### Automatic Flyway Schema Migrations

- All database tables, indexes, and constraints are versioned in `backend/src/main/resources/db/migration/` from **`V1__create_users_table.sql`** through **`V25__application_messaging.sql`**.
- Both `application-dev.yml` and `application-prod.yml` enable `spring.flyway.enabled: true` and `spring.jpa.hibernate.ddl-auto: validate`.
- **No manual SQL migration step is required**—Flyway runs automatically on Backend startup, and Hibernate validates entity mappings against the migrated schema. Never edit already-applied migration files.

### Seed / Demo Accounts (`dev` Profile Only)

When Backend starts with `SPRING_PROFILES_ACTIVE=dev` (the default in `docker-compose.yml`), `DataSeeder.java` (`@Profile("dev")`) idempotently seeds **3 users** (all with password **`123456`**), **13 IT skills**, a verified company (`Demo Tech Company`), and **10 `ACTIVE` internship job postings**:

| Role | Email | Password | Seeded Details |
| :--- | :--- | :--- | :--- |
| **Admin (`ADMIN`)** | `admin@example.com` | `123456` | `Demo Admin` (`ACTIVE`) |
| **Student (`STUDENT`)** | `student@example.com` | `123456` | `Demo Student` (`ACTIVE`, Software Engineering, Ho Chi Minh City) |
| **Company (`COMPANY`)** | `company@example.com` | `123456` | `Demo Tech Company` (`VERIFIED`) with 10 `ACTIVE` IT internship jobs |

### Registering Users & Bootstrapping an Admin Account in Non-`dev` Profiles

When running with `SPRING_PROFILES_ACTIVE=prod` or `e2e`, `DataSeeder` does **not** run:

1. **Students and Companies** can self-register via UI (`/register/candidate`, `/register/recruiter`) or `POST /api/auth/register`:
   - Password must be **at least 6 characters** (`RegisterRequest.java`).
   - New `COMPANY` accounts are created with `CompanyStatus.PENDING` and require an `ADMIN` to verify them before their jobs can be approved/published.
2. **Admin accounts CANNOT self-register.** `AuthServiceImpl.java` explicitly rejects `role: "ADMIN"` with HTTP `400 Bad Request` (`"Admin users cannot self-register"`).
3. **How to bootstrap an Admin in non-`dev` environments:** Generate a BCrypt hash (Backend uses `BCryptPasswordEncoder`) and insert directly into the `users` table (`V1__create_users_table.sql`):

```bash
# Example: generate a BCrypt hash (cost 10) using Python + bcrypt or htpasswd
htpasswd -bnBC 10 "" "YourStrongAdminPassword!" | tr -d ':\n'
```

```sql
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES (
    'admin@yourdomain.com',
    '<paste-bcrypt-hash-here>',
    'System Administrator',
    'ADMIN',
    'ACTIVE'
);
```

---

## 7. Verification & Running Tests

### Service Endpoints & Health Verification

> **Note:** Spring Boot Actuator is **not** included in `backend/pom.xml`, so `/actuator/health` does not exist. Use `GET /api/public/statistics` (also used by `backend/Dockerfile` `HEALTHCHECK`) to verify Backend + PostgreSQL liveness.

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend App** | `http://localhost:5173` | Proxies `/api/**` to `http://127.0.0.1:8080` |
| **Backend Liveness (Public Stats)** | `http://127.0.0.1:8080/api/public/statistics` | Returns HTTP `200` JSON with platform counts |
| **Backend Swagger UI** | `http://127.0.0.1:8080/swagger-ui.html` | Enabled in `dev`; **disabled** in `prod` |
| **Backend OpenAPI JSON** | `http://127.0.0.1:8080/v3/api-docs` | Enabled in `dev`; **disabled** in `prod` |
| **AI Service Health** | `http://127.0.0.1:8000/health` | Public liveness probe (no API key required) |
| **AI Service Swagger UI** | `http://127.0.0.1:8000/docs` | Internal `/internal/*` routes require `X-Internal-Api-Key` header |

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health | Select-Object StatusCode, Content
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/api/public/statistics | Select-Object StatusCode, Content
```

**macOS / Linux (Bash):**
```bash
curl -fsS http://127.0.0.1:8000/health && echo ""
curl -fsS http://127.0.0.1:8080/api/public/statistics && echo ""
```

### Quick End-to-End Connectivity Smoke Checklist

Verify **Frontend → Backend → PostgreSQL → AI Service** works end to end in ~2 minutes:

1. Open **[http://localhost:5173/login](http://localhost:5173/login)** and sign in as `student@example.com` / `123456`.
2. Navigate to **Hồ sơ và CV → Quản lý CV** (`/candidate/cvs`) → **Tải CV mới** (`/candidate/cvs/upload`).
3. Upload the built-in English fixture (`ai-service/tests/fixtures/english_cv.pdf`), keep **Đặt làm CV đang dùng** enabled, and click **Tải lên**.
4. Open **Kết quả phân tích CV** (`/candidate/cvs/{cvId}/analysis`) and click **Phân tích**. Confirm status becomes **`READY`** with extracted canonical IT skills (proves Backend ↔ AI `/internal/cv/parse` + PostgreSQL persistence).
5. Navigate to **Việc làm → Việc làm gợi ý** (`/candidate/jobs/recommended`), select the `READY` CV, and click **Cập nhật gợi ý**. Confirm `SUCCESS` run and ranked jobs appear (proves Backend ↔ AI `/internal/recommendations`).
6. *(Optional)* Apply to **Backend Developer Intern**, open a second browser tab (sessions are isolated per tab in `sessionStorage`), log in as `company@example.com` / `123456`, open **Tuyển dụng → Danh sách tin tuyển dụng** → **Ứng viên phù hợp**, and click **Chạy xếp hạng** (proves Backend ↔ AI `/internal/candidate-rankings`).

### Running Automated Test Suites

#### 1. Frontend Tests, Lint & Production Build (`frontend/`)

**Windows (PowerShell):**
```powershell
Set-Location frontend
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

**macOS / Linux (Bash):**
```bash
cd frontend
npm run test:run
npm run lint
npm run build
```

#### 2. Backend Unit & PostgreSQL Testcontainers Integration Tests (`backend/`)

> Requires **Docker** running for `*IT.java` integration tests (Testcontainers spins up disposable PostgreSQL containers).

**Windows (PowerShell):**
```powershell
Set-Location backend
# Unit tests only (no Docker required)
.\mvnw.cmd -B -ntp test

# Full unit + PostgreSQL Testcontainers integration suite
.\mvnw.cmd -B -ntp clean verify
```

**macOS / Linux (Bash):**
```bash
cd backend
# Unit tests only (no Docker required)
./mvnw -B -ntp test

# Full unit + PostgreSQL Testcontainers integration suite
./mvnw -B -ntp clean verify
```

#### 3. AI Service Tests (`ai-service/`)

**Windows (PowerShell — local venv):**
```powershell
Set-Location ai-service
.\.venv\Scripts\python.exe -m pytest
```

**macOS / Linux (Bash — local venv):**
```bash
cd ai-service
.venv/bin/python -m pytest
```

**Cross-Platform (inside official Linux Docker image — avoids Windows DLL issues):**
```bash
docker compose run --rm -e AI_INTERNAL_API_KEY="test-internal-api-key-at-least-32-characters-ok" ai-service python -m pytest
```

#### 4. Core Docker Smoke Test & Isolated Playwright E2E Suites (Repository Root)

> Requires **Docker Desktop/Engine** and **PowerShell** (`powershell.exe` on Windows or `pwsh` on Linux/macOS).

```powershell
# Isolated V3 Backend-to-AI Docker acceptance smoke (uses ports 15432, 18000, 18080; auto-cleans up)
.\scripts\smoke-core.ps1

# Install Playwright E2E dependencies (first time only)
Set-Location e2e
npm.cmd ci
.\node_modules\.bin\playwright.cmd install chromium
Set-Location ..

# Isolated full-stack Playwright E2E suites (from repository root)
.\scripts\run-neo-aurora-isolated-e2e.ps1 -RunName local-verify
.\scripts\run-application-messaging-isolated-e2e.ps1
.\scripts\run-company-verification-isolated-e2e.ps1
.\scripts\run-recruiting-workflows-isolated-e2e.ps1
.\scripts\run-settings-notifications-isolated-e2e.ps1 -Suite notifications
.\scripts\run-settings-notifications-isolated-e2e.ps1 -Suite analytics
.\scripts\run-settings-notifications-isolated-e2e.ps1 -Suite reliability
```

---

## 8. Troubleshooting & Common Issues

| Issue / Error Message | Root Cause | Solution |
| :--- | :--- | :--- |
| **`ConfigurationError: AI_INTERNAL_API_KEY must be configured` (or `must be at least 32 characters` / `must not have leading or trailing whitespace`)** | AI Service validates `AI_INTERNAL_API_KEY` at import/startup in `ai-service/core/config.py`. | Export `AI_INTERNAL_API_KEY` with **>= 32 characters** and no leading/trailing spaces before starting `uvicorn` or Docker Compose. |
| **Backend fails at startup: `Could not resolve placeholder 'SPRING_DATASOURCE_PASSWORD'`** | `backend/src/main/resources/application-dev.yml` deliberately has **no default** for `SPRING_DATASOURCE_PASSWORD`. | Export `SPRING_DATASOURCE_PASSWORD` in your terminal before running `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`. |
| **Backend fails at startup: `IllegalArgumentException: Verification storage must be an absolute private directory outside the application repository and CV storage`** | `CompanyVerificationDocumentStorage.java` rejects relative paths, paths inside `.git`, or paths overlapping `APP_CV_UPLOAD_DIR`. | Leave `APP_COMPANY_VERIFICATION_STORAGE_DIR` unset (uses `${user.home}/.sjrs/private/company-verification`) or set it to an absolute path outside the repository and separate from `APP_CV_UPLOAD_DIR`. |
| **CV analysis / recommendation fails with `AI_SERVICE_INVALID_RESPONSE` (and AI logs show `401`)** | Mismatched internal API key between Backend (`APP_AI_SERVICE_INTERNAL_API_KEY`) and AI Service (`AI_INTERNAL_API_KEY`). Note that `application.yml`'s fallback key differs from `.env.example`'s key! | Set both `AI_INTERNAL_API_KEY` and `APP_AI_SERVICE_INTERNAL_API_KEY` to the **exact same** >= 32-character string. |
| **`pip install -r requirements.lock` fails on Python 3.12+ or missing compiled spaCy/TF-IDF models** | `requirements.lock` contains CPython `3.11.9` wheel hashes only; local non-Docker runs require compiled `built_models/spacy_custom_model` and `tfidf_model.pkl`. | Install Python **3.11.9** and run `python -m offline.build_spacy_model` + `python -m offline.train_tfidf_incremental --bootstrap`, or run via Docker: `docker compose up --build -d ai-service`. |
| **Login throws `WeakKeyException` (HTTP `500`)** | `JwtTokenProvider.java` uses `Keys.hmacShaKeyFor(...)` (`jjwt 0.13.0`), which requires `APP_JWT_SECRET` to be at least **32 UTF-8 bytes** (validated at runtime, not startup). | Set `APP_JWT_SECRET` to at least 64 characters and restart Backend. |
| **Port already in use (`5432`, `8000`, `8080`, or `5173`)** | Another local PostgreSQL instance or leftover dev process occupies the port. | Change `POSTGRES_PORT`, `AI_PORT`, or `BACKEND_PORT` in `.env` (and update `VITE_API_PROXY_TARGET` / `SPRING_DATASOURCE_URL` accordingly), or stop the conflicting process. |
| **File upload rejected (`413`, `DOCUMENT_TOO_LARGE`, or `UPLOAD_TOO_LARGE`)** | CV uploads are capped at **10 MiB** across 4 settings (`SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE`, `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE`, `APP_CV_MAX_FILE_SIZE_BYTES`, `AI_CV_MAX_FILE_SIZE_BYTES`). Company verification docs are hardcoded to **5 MiB** (PDF/PNG/JPG magic-byte validated). | Keep CVs <= 10 MiB (PDF/DOCX with extractable text, not scanned images) and verification docs <= 5 MiB. If raising CV limits, update all 4 env vars together. |
| **Browser CORS error when calling Backend** | `CorsConfig.java` hardcodes allowed origins to `http://localhost:3000` and `http://localhost:5173` only. | Access the Frontend via `http://localhost:5173` (not `127.0.0.1:5173` or a different port) and keep `VITE_API_BASE_URL=/api` so requests go through Vite's proxy (which strips the `Origin` header). |
| **FastAPI Swagger UI (`/docs`) returns `401 UNAUTHORIZED` on `/internal/*`** | `ai-service/core/security.py` reads `X-Internal-Api-Key` directly from `request.headers` without declaring an OpenAPI `APIKeyHeader` security scheme, so Swagger UI has no "Authorize" button. | Test internal AI endpoints with `curl`/`Invoke-RestMethod` passing `-H "X-Internal-Api-Key: <key>"`, or use a browser header injector (e.g., ModHeader) for `http://localhost:8000/*`. |
| **Flyway migration checksum or validation failure** | Existing local DB volume has incompatible schema or leftover tables from a different branch. | For disposable local dev data only, reset the Postgres volume: `docker compose down --volumes --remove-orphans && docker compose up -d`. |

---

## 9. Configuration Notes & Caveats

During the read-only codebase audit, the following configuration discrepancies, omissions, and hardcoded limits were identified (this guide reflects **actual code behavior**):

1. **PostgreSQL Port Drift (`5432` vs `55432`):**
   - Root `README.md` references PostgreSQL on port `55432`, whereas `.env.example`, `docker-compose.yml`, and `backend/src/main/resources/application-dev.yml` all default to **`5432`**. (`55432` is only configured in `performance/.env.example` and was used as a local `.env` override during verification.)
2. **Node.js Version Drift (`20+` vs `24`):**
   - Root `README.md` lists `Node.js 20+`, whereas `.github/workflows/frontend-ci.yml`, `docs/runbook.md`, and `e2e/README.md` pin **Node.js `24`**. `frontend/package.json` does not declare an `engines` field.
3. **Environment Variables Missing from `.env.example`:**
   - `AI_CANDIDATE_RANKING_MAX_CANDIDATES` and `AI_CANDIDATE_RANKING_MAX_REQUEST_BYTES` are wired in `docker-compose.yml` and `ai-service/core/config.py`, but omitted from `.env.example` (only the Backend `APP_AI_CANDIDATE_RANKING_*` counterparts are in `.env.example`).
   - `APP_COMPANY_VERIFICATION_STORAGE_DIR` is used by `application.yml` and `CompanyVerificationDocumentStorage.java`, but omitted from `.env.example`, `docker-compose.yml`, and `application-prod.yml`.
4. **Ephemeral Verification Document Storage in `docker-compose.yml`:**
   - `docker-compose.yml` mounts persistent named volumes for `postgres_data` and `cv_uploads` (`/app/data/cvs`), but does **not** mount a volume for `APP_COMPANY_VERIFICATION_STORAGE_DIR` (defaults inside the container to `/home/app/.sjrs/private/company-verification`). Uploaded company verification documents inside Docker will not survive container recreation unless a volume and `APP_COMPANY_VERIFICATION_STORAGE_DIR` are added.
5. **Mismatched Default Internal API Keys Between `application.yml` and `.env.example`:**
   - `backend/src/main/resources/application.yml` falls back to `change-this-development-ai-internal-key-at-least-32-characters`, while `.env.example` uses `change-this-local-ai-internal-api-key-at-least-32-characters`. Docker Compose keeps them synchronized automatically via `AI_INTERNAL_API_KEY`, but manual local runs **must** export matching values explicitly.
6. **Hardcoded Runtime Limits & Settings:**
   - **CORS origins** (`CorsConfig.java`): Hardcoded to `http://localhost:3000` and `http://localhost:5173`; not env-configurable.
   - **Frontend Axios timeout** (`frontend/src/services/api/httpClient.ts`): Hardcoded to `40_000` ms (40s).
   - **Company verification upload limit** (`CompanyVerificationDocumentStorage.java`): Hardcoded to `5 MiB` (`5 * 1024 * 1024` bytes), accepting only PDF, PNG, and JPG validated via magic bytes.
   - **Auth token storage** (`frontend/src/services/auth/authService.ts`): Stored in `window.sessionStorage` (tab-isolated sessions), not `localStorage`.
7. **AI Service Unified Internal Routes & `/health` Metadata:**
   - `ai-service/main.py` mounts the unified internal router (`/internal/cv/parse`, `/internal/recommendations`, `/internal/candidate-rankings`), and `GET /health` reports `algorithm`, `recommendationVersion`, `candidateRankingVersion`, and `processingVersion`.
8. **No Frontend Container in `docker-compose.yml` & No Backend Actuator:**
   - `docker-compose.yml` only manages `postgres`, `ai-service`, and `backend`; `frontend/` must be started separately with Node/npm.
   - Backend does not include `spring-boot-starter-actuator`; `GET /api/public/statistics` serves as the liveness probe.
9. **Build Artifact Drift in `frontend/`:**
   - `frontend/` currently contains pre-emitted `vite.config.js` and `vite.config.d.ts` alongside `vite.config.ts` (all three define the same `/api` proxy to `VITE_API_PROXY_TARGET || "http://127.0.0.1:8080"`).
