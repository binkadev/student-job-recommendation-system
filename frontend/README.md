# Frontend

React + TypeScript frontend for the Student Job Recommendation System.

## Architecture Boundary

```text
Browser -> Spring Boot Backend -> FastAPI AI Service
                              -> PostgreSQL
```

The frontend calls Backend endpoints under `/api` and sends the user's Bearer
JWT where required. It does not call the AI Service, send
`X-Internal-Api-Key`, or implement recommendation scoring/ranking.

The Backend remains the source of truth for authorization, business state,
eligible jobs, recommendation validation, `rankPosition`, and persistence.

## Requirements

- Node.js 24, matching [Frontend CI](../.github/workflows/frontend-ci.yml)
- npm with lockfile support
- a running Backend at `http://127.0.0.1:8080` for local API flows

## Setup and Run

From `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The default development URL is `http://localhost:5173`. Vite proxies `/api` to
`http://127.0.0.1:8080`; override the target for local development with
`VITE_API_PROXY_TARGET`. `VITE_API_BASE_URL` defaults to `/api`.

Do not commit local `.env` files or put Backend/AI secrets in frontend
environment variables.

## Verification

```powershell
npm ci
npm run lint
npm run build
```

CI performs the same locked install, lint, and production build. No dependency
or lockfile update is needed for documentation-only changes.

## CV Runtime States

Candidate CV screens use Backend state rather than assuming analysis succeeded:

- a new upload is not treated as analyzed;
- `NOT_READY` and `PROCESSING` do not display derived analysis as ready;
- only `READY` CVs can be selected for recommendation generation;
- `FAILED` analysis displays its failure state and allows the user to retry;
- upload, activate, open, reanalyze, and delete actions call Backend APIs;
- CV ownership and deletion rules are enforced by the Backend, not local state.

## Recommendation Runtime States

The candidate recommendation screen:

- loads CV analysis status and enables generation only for a selected `READY`
  CV;
- loads recommendation runs and the latest successful persisted results from
  Backend APIs;
- distinguishes `SUCCESS` from failed or incomplete latest runs;
- displays sanitized run errors when provided by the Backend;
- allows viewing a historical successful run without presenting it as the
  current result;
- respects Backend-provided `rankPosition` and does not recompute production
  ranking.

These runtime-state fixes are merged on `master`. They do not replace manual
browser verification.

## Manual E2E Still Pending

The following must still be run and recorded against a clean `master` stack:

- Student login, CV upload/reanalysis, recommendation generation and apply;
- Company profile/job/application flows;
- Admin company/job approval and protected administration flows;
- role and ownership denial cases;
- the complete Company → Admin → Student recommendation journey.

Use the shared [E2E demo checklist](../docs/testing/e2e-demo-checklist.md). Do
not mark a scenario as passed without runtime evidence.
