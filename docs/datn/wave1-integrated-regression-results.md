# Wave 1 Integrated Regression Results (`082cba27`)

## 1. Baseline & Merged Scope

- **Branch verified:** `master` (`082cba27`)
- **Merged Wave 1 PRs:**
  - **W1-B1 (`1124f3ed`, PR #68):** Company workspace fixes (`/companies/me/jobs` pagination & `ACTIVE` scope in `RecruiterCompanyPage`, owner-scoped job filter >100 jobs & zero-applicant jobs in `RecruiterCandidatesPage`, Backend DTO limits `255`/`10000` and skill `importanceLevel`/`minimumLevel` persistence in `RecruiterJobsPage`).
  - **W1-A (`3e19bc25`, PR #69):** Student workspace fixes (Saved Searches route `/candidate/jobs/saved-searches` & CRUD/apply-filter integration, CV V2 analysis metadata display, deterministic CV review route `/candidate/cvs/:cvId/review`).
  - **W1-C (`082cba27`, PR #70):** Real automatic notifications (`NotificationServiceImpl` post-commit delivery, Student apply/withdraw notifications to owning Company, Admin Job moderation and Company verification/block notifications, Student Recommendation V3 generation notification, notification preference & RBAC enforcement, Vietnamese inbox rendering and safe navigation).

## 2. Test Execution Summary

| Layer | Command / Suite | Passed | Failed | Notes |
| --- | --- | ---: | ---: | --- |
| Frontend Lint | `npm run lint` | 1 | 0 | Clean (`eslint .` exited `0`) |
| Frontend Typecheck + Build | `npm run build` (`tsc -b && vite build`) | 0 | 1 | `tsc -b` failed with 2 TypeScript errors in `src/pages/candidate/CandidateW1AWorkspace.test.tsx`; production bundle `npx vite build` succeeded (`2456` modules) |
| Frontend Unit Tests | `npx vitest run` | 263 | 0 | `42/42` test files passed (includes `CandidateW1AWorkspace.test.tsx`, `RecruiterW1B1Company.test.tsx`, `notificationDisplay.test.ts`) |
| Backend Unit Tests (Surefire) | `./mvnw -B -ntp verify` | 249 | 0 | `41/41` test classes passed |
| Backend Integration Tests (Failsafe) | `./mvnw -B -ntp verify` | 284 | 0 | `39/39` `*IT` classes passed on Testcontainers PostgreSQL (includes `AutomaticNotificationsApiIT` `13/13`, `CompanyOwnJobsApiIT` `5/5`, `ApplicationLifecycleApiIT` `6/6`, `JobModerationApiIT` `9/9`) |
| Playwright E2E — W1-B1 Isolated | `diagnostics/w1b1-company-isolated.spec.mjs` | 3 | 0 | `B1-01`, `B1-02`, `B1-03 & B1-04` via `CompanyW1B1BrowserFixture` |
| Playwright E2E — W1-C Isolated | `diagnostics/automatic-notifications-isolated.spec.mjs` | 6 | 0 | `N01`–`N06` via `AutomaticNotificationsBrowserFixture` + real AI Service |
| Playwright E2E — API & V3 Scoring | `tests/api.spec.mjs` | 12 | 0 | `A01`–`A12` via `NeoAuroraBrowserFixture` |
| Playwright E2E — Core Browser Flows | `tests/browser.spec.mjs` | 17 | 0 | `B01`–`B13` via `NeoAuroraBrowserFixture` (`B07` verified after `A10` seeds `job-2` applications) |
| Playwright E2E — W1-A Student Workspace | `tests/w1a-student-workspace.spec.mjs` | 1 | 0 | Saved Searches CRUD/filter + CV V2 analysis + `/candidate/cvs/:cvId/review` |
| Playwright E2E — Route Inventory | `tests/routes.spec.mjs` | 1 | 0 | `R01` all 80 non-Admin declared routes & RBAC redirects |
| Playwright E2E — Company Own Jobs | `tests/own-jobs.spec.mjs` | 7 | 0 | `J01`, `J02`, `J03-375`..`J03-1440` |
| Playwright E2E — Settings & Notifications | `tests/settings-notifications.spec.mjs` | 10 | 0 | `N01`–`N07` across Candidate & Recruiter |

## 3. Documented Failures

### 3.1 `npm run build` (`tsc -b`) Test File Type Inference Defect

- **File:** `frontend/src/pages/candidate/CandidateW1AWorkspace.test.tsx`
- **Locations & Compiler Diagnostics:**
  - Line `182`, col `22` (`TS2345`): `Argument of type '{ id: number; name: string; keyword: string | null; location: string | null; jobType: string | null; workingModel: string | null; createdAt: string; updatedAt: string; }' is not assignable to parameter of type '{ id: number; name: string; keyword: string; location: string; jobType: string; workingModel: string; createdAt: string; updatedAt: string; }'.`
  - Line `194`, col `13` (`TS2322`): `Type 'string | null' is not assignable to type 'string'.`
- **Root Cause:** In `CandidateW1AWorkspace.test.tsx` (lines `149`–`160`), the mock `items` array is initialized without an explicit `SavedSearchItemDto[]` (or nullable property) type annotation, causing TypeScript to infer non-nullable `string` fields before the mock `POST`/`PUT` handlers assign `string | null`.
- **Runtime Impact:** None on runtime or Vite bundling (`npx vite build` and `npx vitest run` both succeed).

## 4. Functional & Contract Verification

1. **Route Navigation (`routes.spec.mjs`, `w1a-student-workspace.spec.mjs`):** All 80 non-Admin routes (105 total declared routes including `/candidate/cvs/:cvId/review` and `/candidate/jobs/saved-searches`) render without uncaught page errors and enforce role guards (`/403` / `/login`).
2. **API Compatibility & Authentication (`api.spec.mjs`, `settings-notifications.spec.mjs`):** JWT login, session isolation, ETag concurrency (`If-Match` `428`/`409` on profile and settings), and owner-scoped `/api/companies/me/jobs` pagination (`size` up to `100`, >100 rows across pages) work together without conflict.
3. **Automatic Notifications (`AutomaticNotificationsApiIT`, `automatic-notifications-isolated.spec.mjs`):** Student apply/withdraw, Admin Job moderation/Company verification, and Student V3 recommendation generation emit post-commit notifications, respect `user_notification_settings`, block duplicates/invalid transitions, and navigate safely from Student and Company inboxes.
4. **Recommendation & Candidate Ranking V3 (`api.spec.mjs` `A04`/`A10`, `browser.spec.mjs` `B05`/`B07`, `automatic-notifications-isolated.spec.mjs` `N05`):** Persisted CV V2 `READY` snapshots drive V3 `PRIMARY` (`SAME_LANGUAGE_HYBRID`) and `FALLBACK` (`CROSS_LANGUAGE_SKILL_BASED`) scoring and trigger Student recommendation notifications upon completion.

## 5. Manual-Demo Database Preservation

Read-only row-level MD5 verification (`BEGIN READ ONLY; ... md5(row_to_json(r)::text)`) against `student-job-recommendation-system-postgres-1` confirmed zero mutations across all 19 public tables (`3,181` rows total):

- **Pre-verification snapshot:** `2026-11-10T19:05:58.295Z` (`19` tables, `3,181` rows)
- **Post-verification snapshot:** `2026-11-10T19:20:32.808Z` (`19` tables, `3,181` rows)
- **Comparison result:** `identical = true` (`users: 45`, `students: 33`, `companies: 11`, `jobs: 196`, `applications: 210`, `cv_files: 20`, `recommendation_runs: 93`, `recommendation_results: 1906`, `candidate_ranking_runs: 56`, `candidate_ranking_results: 165`, `notifications: 222`)
