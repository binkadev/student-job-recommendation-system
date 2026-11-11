# W3-C1B — Interviews and job invitations Frontend

Baseline: `master` at `f58217ddab3dc60c17bd4822e931843f562c519e` (merged W3-C1A). Dedicated worktree: `.worktrees/datn-w3c1b-interviews-invitations-frontend`, branch `feat/datn-w3c1b-interviews-invitations-frontend`. Backend API contract remains [W3-C1A](interviews-invitations-backend.md).

## Supported UI routes

| Role | Routes | Workflow |
| --- | --- | --- |
| Company | `/recruiter/interviews`, `/create`, `/:interviewId` | Paged list, owned detail, schedule, cancel, complete |
| Student | `/candidate/interviews`, `/:interviewId` | Paged list/detail, confirm or decline before start |
| Company | `/recruiter/invitations`, `/create`, `/:invitationId` | Send from applicant/saved context, list/detail, cancel PENDING |
| Student | `/candidate/invitations`, `/:invitationId` | Paged list/detail, accept/decline PENDING, normal Job/application link |

Suffixes in the table are relative to the route family. Existing interview/Student invitation routes now use shared recruiting components. Company invitation routes are added under the existing recruiter role guard. Applicant list/detail and saved-candidate rows launch an invitation using the source application ID. The hardcoded Student invitation #1 navigation shortcut is removed; detail links now use actual returned IDs.

All user workflows use the shared Axios httpClient with its existing JWT/session interceptors. No production mock dataset, new dependencies, Backend endpoint or authentication behavior is introduced. Exact payloads match merged DTOs: interview applicationId/title/scheduledAt/durationMinutes/meetingType/locationOrLink/notes; invitation studentId/jobId/message; every PATCH sends captured expectedStatus + target status.

Schedule application options come from the paged owned Company applications API, showing only PENDING/REVIEWED/ACCEPTED entries on that page. Source deep links are re-fetched through `/companies/me/applications/{id}`. Invitation Student ID is derived from that authorized response, never an editable field or a URL studentId. Target Job choices come from paged `/companies/me/jobs?status=ACTIVE` and omit visibly expired records. The Backend remains responsible for current Company verification, Student eligibility, ownership, moderation and all application rules.

The Backend has no interview/invitation detail GET. Deep links search only the principal's scoped list, sequentially at 100 records/request until found or exhausted, retaining only one page. List UIs request 10/page. Traversal is abortable; errors/malformed responses are not represented as empty lists. This can require multiple requests for an older record, and a moving list may require manual reload. No global/private detail endpoint is invented.

## Status, concurrency and session safety

Actions are offered only for supported states: Student SCHEDULED interview confirm/decline before the apparent start; Company SCHEDULED/CONFIRMED cancel and CONFIRMED complete after the apparent end; Student PENDING invitation accept/decline; Company PENDING cancel. Terminal and unknown states have no actions. The existing focus-trapped Modal confirms the selected action against its captured status. Confirmed UI changes only after a successful response.

409 RECRUITMENT_STATE_CONFLICT keeps the loaded record and pending action visible, shows Vietnamese feedback and offers manual status reload. No PATCH retry or automatic conflict refetch occurs. Other uncertain mutation errors also require explicit reload before selecting another action. Reload closes the unperformed action, fetches current owned data and requires a fresh user selection. Duplicate clicks are prevented synchronously as well as through disabled controls. 409 INVITATION_ALREADY_PENDING preserves the invitation message and Job selection and links to sent invitations without duplicating the write. Failed creation keeps the form draft; successful submission cannot be re-sent by duplicate clicks.

Existing ProtectedRoute/RoleRoute remain authoritative for UI routing; feature pages additionally require the authenticated context's expected role. Workspace identity includes user, token and in-memory session version. Reads/mutations use existing useSessionAlive plus AbortController, discard stale results after account changes/unmount, and abort further detail pages. No profile/record/draft cache is persisted in localStorage or shared between accounts. Local storage role values and caller ownership fields are not authority. Server RBAC remains authoritative.

Unrelated messaging, member administration, settings and password-recovery placeholders remain fail-closed. Their assertions remain unchanged; obsolete interview/invitation unsupported assertions are replaced by focused supported-workflow coverage.

## Time and remaining limits

Datetime-local input is sent as its literal wall-clock value (browsers may omit zero seconds). No Z/offset is appended and toISOString is not used. Backend timestamps are displayed directly as day/month/year hour:minute with a server-time label. Calendar validation/completion arithmetic operates on Gregorian fields without interpreting Backend values as UTC/browser instants, including across DST boundaries.

The API supplies neither a server timezone nor a current server clock. Future/past action hints compare against the device's local calendar fields, update periodically and are explicitly labeled as hints. If device/server timezones or clocks differ, a hint may differ from server eligibility; the Backend makes the final decision and errors preserve confirmed data. Users must enter the intended server-local time. No rescheduling, availability, reminder, timezone synchronization or calendar integration is claimed.

Invitation acceptance never creates an Application. Links lead to the existing Job screen and normal application flow, preserving CV ownership, Job eligibility, reapplication and lifecycle rules. Company/Job/Student references use real response IDs; missing optional messages/notes remain empty-state text rather than fabricated data.

## Focused verification (2026-11-11)

HTTP is mocked for component tests; this PR makes no live E2E claim. No Playwright, Backend, AI or demo-database command is run.

```powershell
cd frontend
npm.cmd run test:run -- src/features/recruiting src/pages/UnsupportedCapabilities.test.tsx src/pages/recruiter/RecruiterCandidateSearch.test.tsx src/features/recruiter/saved-candidates/SavedCandidatesPage.test.tsx src/app/router/RouteContent.test.tsx src/services/auth/authSession.test.ts
npm.cmd run test:run -- src/features/recruiting
npm.cmd run build
```

Final focused results across targeted runs: **98 distinct tests pass** (74 recruiting/API/time/real-router cases plus 24 existing launcher, unsupported, route-recovery and HTTP-session cases). Setup fixes were limited to new test syntax/types, a UTF-8 expectation and browser-normalized zero seconds; URL-boundary checks were then tightened and the three new files rechecked. TypeScript/production build and scoped ESLint pass. The unrelated Core Smoke PRIMARY/FALLBACK issue is untouched.
