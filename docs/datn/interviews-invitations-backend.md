# W3-C1A: Interviews and job invitations (Backend, V24)

Baseline: `master` at `53c149441a02e29956b5b963529e39803dc007d7`. This package implements Backend only. No interview/invitation UI integration, AI behavior, notifications, password recovery or automatic application creation is implemented here. The task decision supersedes the old roadmap: W2-C password recovery is removed; V24 belongs to interviews/invitations rather than the old V25 reservation.

## API and ownership

All routes require an active authenticated JWT and use `ApiResponse<T>`. No new public/Admin access is introduced. Company/Student identity comes from the authenticated user, never request ownership fields. These endpoints return only the recruiting record fields/IDs; they do not include email, CV, private documents or user credentials. Creation/response DTO debug rendering is redacted so framework DEBUG messages do not print private meeting details or invitation messages.

| Role | Method | Route | Body/result |
| --- | --- | --- | --- |
| COMPANY | POST | `/api/companies/me/interviews` | CreateInterviewRequest → InterviewResponse |
| COMPANY | GET | `/api/companies/me/interviews` | PageResponse<InterviewResponse> |
| COMPANY | PATCH | `/api/companies/me/interviews/{id}/status` | expectedStatus + status |
| STUDENT | GET | `/api/students/me/interviews` | PageResponse<InterviewResponse> |
| STUDENT | PATCH | `/api/students/me/interviews/{id}/respond` | expectedStatus + status |
| COMPANY | POST | `/api/companies/me/invitations` | CreateInvitationRequest → InvitationResponse |
| COMPANY | GET | `/api/companies/me/invitations` | PageResponse<InvitationResponse> |
| COMPANY | PATCH | `/api/companies/me/invitations/{id}/status` | expectedStatus + CANCELLED |
| STUDENT | GET | `/api/students/me/invitations` | PageResponse<InvitationResponse> |
| STUDENT | PATCH | `/api/students/me/invitations/{id}/respond` | expectedStatus + status |

The Company invitation status route is the minimal additional endpoint needed for the required owner cancellation action. Lists use `page=1`, `size=10`, size 1–100, page >=1; invalid bounds return 400. Sorting is fixed `createdAt DESC, id DESC`; ownership filtering/counting/paging happens in the database. There is no caller-defined sort or ownership filter. Responses use 1-based pages and include `items`, `page`, `size`, `totalItems`, `totalPages`.

CreateInterviewRequest: `applicationId` (positive), `title` (nonblank, max255), `scheduledAt` (future LocalDateTime, e.g. `2027-01-15T09:00:00`), `durationMinutes` (15–480), `meetingType` (ONLINE/ONSITE), `locationOrLink` (required, max1000), optional `notes` (max5000). The Company must own the Application's Job and be VERIFIED. Application must be PENDING/REVIEWED/ACCEPTED and Student active. Application, Student, Job and Company IDs are derived together from the persisted Application. Online details must be absolute HTTP(S), have a host, no credentials/whitespace, and a valid optional port. Onsite details are a nonblank address/location. Existing applicants can still be interviewed after their Job closes; Job public visibility/deadline gates apply to new invitations, not follow-up interviews on an existing live Application.

CreateInvitationRequest: `studentId`, `jobId` (positive), optional `message` (max5000). The Job must belong to the authenticated Company, be ACTIVE, have no past deadline, and the Company must be VERIFIED. Target Student must be active and already associated with that Company's applicants (any historical Application to its Jobs) or its SavedCandidate records. SavedCandidate remains a Company–Student relation with an Application source; no global Student directory is introduced. A historical application association does not imply eligibility to apply again.

InterviewResponse contains id/applicationId/companyId/studentId/jobId, title, scheduledAt, durationMinutes, meetingType, locationOrLink, notes, status, createdAt, updatedAt. InvitationResponse contains id/companyId/studentId/jobId, message, status, createdAt, updatedAt.

## State machine and concurrency

| Record | Actor | From | To | Additional condition |
| --- | --- | --- | --- | --- |
| Interview | Student owner | SCHEDULED | CONFIRMED / DECLINED | Before scheduled start |
| Interview | Company owner | SCHEDULED / CONFIRMED | CANCELLED | None |
| Interview | Company owner | CONFIRMED | COMPLETED | Scheduled start + duration has elapsed |
| Invitation | Student owner | PENDING | ACCEPTED / DECLINED | None |
| Invitation | Company owner | PENDING | CANCELLED | None |

All other transitions, including no-ops and terminal transitions, return 400 BAD_REQUEST. Missing expectedStatus/invalid DTOs return 400. Missing records return 404; foreign owners/wrong roles return 403. Ownership is checked before state comparison. A captured expectedStatus that no longer matches the locked row returns `409 RECRUITMENT_STATE_CONFLICT`. Clients must reload/compare; no retry or overwrite policy is provided. PATCH never accepts Company/Student IDs as authority.

Mutations lock the interview/invitation row before authorization/state checks and flush within one transaction. Because no transition returns to an earlier state, expectedStatus acts as a non-ABA precondition without a new version column. Creation locks Company first (matching moderation lock order); invitation creation also locks its Job before checking moderation/deadline. Interview creation locks the Application before checking its lifecycle. No external call/notification producer runs in these transactions.

Only PENDING invitations are outstanding/active. A PostgreSQL partial unique index on `(company_id, student_id, job_id) WHERE status='PENDING'` prevents concurrent duplicates; collisions return `409 INVITATION_ALREADY_PENDING`. ACCEPTED/DECLINED/CANCELLED are retained history, and a later distinct PENDING invitation is allowed. The Company lock serializes API creation; the unique index also protects other database writers. No record is hard deleted.

## Schema and limitations

V24 adds `interviews` and `job_invitations` only, with BIGSERIAL IDs, restrictive FKs, VARCHAR-backed status/type CHECKs, duration/nonblank meeting/title checks, timestamp defaults and owner-list indexes. No V1–V23 checksums or existing rows/tables change. Cross-record consistency is derived/checked in Backend; individual FKs do not themselves enforce the redundant Interview Application/Company/Student/Job tuple. No direct SQL writer should bypass the service.

- Times use the established server-local `LocalDateTime`/TIMESTAMP convention; timezone-aware scheduling, reminders, calendar sync, availability and overlapping-interview detection are not implemented.
- Multiple interview rounds per Application are allowed. No rescheduling/delete endpoint is introduced.
- Existing recruiting records remain private history if Company/Job/Application status later changes; this PR does not auto-cancel or cascade states. New creation always checks current applicable eligibility; existing owners can read/respond/cancel their records.
- Accepting an invitation does not create or change an Application. Existing apply eligibility, CV ownership, latest-REJECTED/reapply rules, WITHDRAWN blocking and active Application uniqueness remain authoritative.
- No Frontend capability is claimed; no notification contract, AI/V3 ranking, JWT or password-reset behavior is changed. Core Smoke PRIMARY/FALLBACK is outside scope.

## Focused verification

Tests use the existing isolated PostgreSQL 17 Testcontainers architecture; no demo database is accessed. New tests cover schema upgrade/data preservation, FK/CHECK/partial uniqueness constraints, owner/role boundaries, validation, exact pagination, complete actor/state matrices, real concurrent status changes and duplicate creation. Existing Application lifecycle tests and explicitly targeted V22→V23 migration tests are retained; only final latest-version expectations move to V24. The no-db context supplies mocks for the two new repositories.

```powershell
cd backend
.\mvnw.cmd -B -ntp test failsafe:integration-test failsafe:verify '-Dtest=JobRecommendationApplicationTests' '-Dit.test=RecruitingWorkflowApiIT,RecruitingWorkflowMigrationIT,DatabaseMigrationIT,DatabaseAiContractV2MigrationIT,DatabaseRecommendationRankingV3MigrationIT,CompanyProfileExtensionsMigrationIT,ApplicationLifecycleApiIT'
```

No full Backend regression, Frontend, AI or Playwright run is part of this package.

### Results (2026-11-11)

- 33 workflow cases pass, including 82 actor/state combinations across two exhaustive matrix tests, owner/RBAC/pagination/validation checks, concurrent status updates and concurrent duplicate creation.
- 2 new V24 migration cases pass: populated V23 upgrade preserves old rows, exact V1–V24 version list, idempotence/validation, new FK/CHECK/index constraints and retained terminal invitation history.
- 12 existing PostgreSQL cases pass: ApplicationLifecycleApiIT (6), CompanyProfileExtensionsMigrationIT (1, retains explicit V22→V23 target), DatabaseAiContractV2MigrationIT (1), DatabaseMigrationIT (1), DatabaseRecommendationRankingV3MigrationIT (3). No-db context test passes (1).
- Total: 48 distinct focused cases pass across targeted invocations. Initial new-schema assertion was corrected to count versioned migrations only, excluding Flyway's schema-creation marker. The two new classes were rerun after that focused fix; workflow was additionally rerun after DTO log redaction.

Focused rechecks:

```powershell
.\mvnw.cmd -B -ntp test-compile failsafe:integration-test failsafe:verify '-Dit.test=RecruitingWorkflowApiIT,RecruitingWorkflowMigrationIT'
.\mvnw.cmd -B -ntp test-compile failsafe:integration-test failsafe:verify '-Dit.test=RecruitingWorkflowApiIT'
```

No released migration, existing application/ranking behavior, Frontend or AI source changed. This is focused verification, not full regression or browser verification.
