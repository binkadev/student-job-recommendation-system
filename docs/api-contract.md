# API Contract

Multipart requests exceeding the servlet file/request size limits return `413`
with the normal error envelope and `errorCode: "UPLOAD_TOO_LARGE"`. The message
does not expose multipart parser exceptions or storage details. Limits remain
configurable; the default file and total multipart request limits are both 10 MB,
so multipart framing also counts toward the request limit. This does not change
CV type validation or the AI parsing/scoring contracts.

Backend base URL: `http://localhost:8080`

JSON responses use `ApiResponse<T>`.

Successful CV file responses are the only exception: they stream the raw file body as a Spring `Resource`. Their error responses still use `ApiResponse<T>`.

Success:

```json
{
  "success": true,
  "message": "Success",
  "errorCode": null,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Error message",
  "errorCode": "ERROR_CODE",
  "data": null
}
```

Paged data:

```json
{
  "items": [],
  "page": 1,
  "size": 10,
  "totalItems": 100,
  "totalPages": 10
}
```

Paged list endpoints use 1-based `page` values. `size` is capped at 100 unless an endpoint states a lower default. New Phase 1 sortable list endpoints accept `sort` as `field,asc`, `field,desc`, `field:asc`, or `field:desc`; unsupported sort fields return `BAD_REQUEST`.

Authentication uses `Authorization: Bearer <jwt>` for all protected endpoints.

## Common Transport Headers

These headers are transport metadata and do not change any request or response
DTO.

| Header | Direction | Behavior |
|---|---|---|
| `Authorization: Bearer <jwt>` | Client → Backend | Required by protected public Backend endpoints. The user JWT is never forwarded to the AI Service. |
| `X-Internal-Api-Key` | Backend → AI Service | Required on all `/internal/v2/**` and `/internal/v3/**` routes. AI reads `AI_INTERNAL_API_KEY`; Backend sends the same secret from `APP_AI_SERVICE_INTERNAL_API_KEY`. Missing, blank, or incorrect values receive a sanitized `401 UNAUTHORIZED`. |
| `X-Request-Id` | Client → Backend → AI Service | Optional tracing metadata. A valid incoming value is propagated; otherwise each service generates a valid UUID. Backend and AI include the accepted/generated value in the response header. |

`X-Request-Id` is not an authentication token and grants no access. It is
independent of the Contract V2/V3 JSON field `requestId`: the header correlates
transport logs, while the body field identifies a recommendation business
request. They are not required to match.

Real JWTs, internal API keys, and other secrets must not be recorded in
documentation or logs. `/health` and `/internal/v1/**` on the AI Service do not
require `X-Internal-Api-Key`. See
[Request Tracing](operations/request-tracing.md) for validation and safe logging
rules.

Common protected-endpoint errors:

- `UNAUTHORIZED`: missing, invalid, expired, `BLOCKED`, or `INACTIVE` user token.
- `ACCESS_DENIED`: authenticated user does not have the required role, or an endpoint reports failed ownership as forbidden.
- `RESOURCE_NOT_FOUND`: requested resource does not exist or is intentionally hidden from that endpoint.
- `VALIDATION_ERROR`: invalid request body or query parameter.
- `BAD_REQUEST`: invalid enum transition, duplicate business action, or unsupported sort.
- `APPLICATION_ALREADY_ACTIVE`: a PENDING/REVIEWED/ACCEPTED Application exists for this Student/Job (`409 Conflict`).
- `CV_IN_USE`: the requested CV is referenced by an application or another protected record and cannot be deleted (`409 Conflict`).
- `CV_ANALYSIS_NOT_READY`: recommendation generation selected a CV whose persisted analysis status is not `READY`, or whose processed text or required language/version metadata is absent or incompatible (`409 Conflict`).
- `CV_ANALYSIS_FAILED`: an unexpected CV-analysis integration failure occurred (`502 Bad Gateway`).
- `FEATURE_NOT_SUPPORTED`: an authenticated owner requested a compatibility endpoint that is intentionally unavailable in the MVP (`501 Not Implemented`).
- `AI_SERVICE_UNAVAILABLE`: the AI service connection failed (including a socket reset during response-body reading) or the service returned a server error (`503 Service Unavailable`).
- `AI_SERVICE_TIMEOUT`: the AI service exceeded the configured read/connect timeout (`504 Gateway Timeout`).
- `AI_SERVICE_INVALID_RESPONSE`: the AI service rejected the request, returned malformed JSON, or violated its typed response contract (`502 Bad Gateway`).
- `RECOMMENDATION_RUN_NOT_FOUND`: a recommendation run is absent or not owned by the current student (`404 Not Found`).
- `RECOMMENDATION_GENERATION_FAILED`: recommendation persistence or another non-AI generation phase failed (`502 Bad Gateway`).
- `SAVED_CANDIDATE_ALREADY_EXISTS`: the company has already saved that student (`409 Conflict`).
- `SAVED_CANDIDATE_NOT_FOUND`: the saved-candidate id is absent or is not owned by the current company (`404 Not Found`).
- `SAVED_SEARCH_ALREADY_EXISTS`: the student already has a case-insensitively equal saved-search name (`409 Conflict`).
- `SAVED_SEARCH_NOT_FOUND`: the saved-search id is absent or is not owned by the current student (`404 Not Found`).
- `INVALID_CURRENT_PASSWORD`: password change failed because the current password did not match (`400 Bad Request`).
- `INTERNAL_SERVER_ERROR`: an unexpected server or file-storage operation failed.

## Enums

- `UserRole`: `STUDENT`, `COMPANY`, `ADMIN`
- `UserStatus`: `ACTIVE`, `INACTIVE`, `BLOCKED`
- `CompanyStatus`: `PENDING`, `VERIFIED`, `BLOCKED`
- `JobType`: `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `CONTRACT`
- `WorkingModel`: `ONSITE`, `HYBRID`, `REMOTE`
- `JobStatus`: `DRAFT`, `PENDING_APPROVAL`, `ACTIVE`, `CLOSED`, `REJECTED`, `EXPIRED`
- `SkillLevel`: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`
- `SkillSource`: `MANUAL`, `CV_EXTRACTED`, `ADMIN_SEEDED`
- `SkillImportance`: `REQUIRED`, `PREFERRED`, `NICE_TO_HAVE`
- `ApplicationStatus`: `PENDING`, `REVIEWED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`
- `RecommendationSourceType`: `PROFILE`, `CV`, `PROFILE_AND_CV`
- `RecommendationRunStatus`: `PROCESSING`, `SUCCESS`, `FAILED`
- `CvAnalysisStatus`: `NOT_READY`, `PROCESSING`, `READY`, `FAILED`
- `RecommendationRankingTier`: `PRIMARY`, `FALLBACK`
- `RecommendationScoringStrategy`: `SAME_LANGUAGE_HYBRID`, `CROSS_LANGUAGE_SKILL_BASED`
- `NotificationType`: `APPLICATION_STATUS_CHANGED`, `JOB_STATUS_CHANGED`, `SYSTEM`, `RECOMMENDATION`
- `ReferenceType`: `APPLICATION`, `JOB`, `RECOMMENDATION_RUN`

## Public Auth

### POST `/api/auth/register`

Registers a `STUDENT` or `COMPANY` user.

Request:

```json
{
  "email": "student@example.com",
  "password": "123456",
  "role": "STUDENT",
  "fullName": "Demo Student",
  "phone": "0900000000",
  "companyName": "Demo Company"
}
```

Response data: `AuthUserResponse` with `id`, `email`, `fullName`, `phone`, `role`, `status`, `lastLoginAt`, `createdAt`. `passwordHash` is never returned.

Registering `COMPANY` creates a `PENDING` Company profile and an `ACTIVE` User account. Login/profile completion/DRAFT jobs are allowed; only Admin can verify the Company. User status and Company verification status are separate.

### POST `/api/auth/login`

Request:

```json
{
  "email": "student@example.com",
  "password": "123456"
}
```

Response data: `token`, `tokenType`, `expiresIn`, `user`.

### GET `/api/auth/me`

Roles: authenticated users.

Response data: current `AuthUserResponse`.

### PATCH `/api/users/me/password`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Request:

```json
{
  "currentPassword": "current password",
  "newPassword": "new password"
}
```

Both fields are required. The new password must be at least 6 characters and no password input may exceed 72 UTF-8 bytes, respecting BCrypt's input limit. The new password must differ from the current password.

An incorrect current password returns `400 INVALID_CURRENT_PASSWORD`. On success, only the authenticated user's encoded password and normal audit timestamp are updated; neither plaintext password nor the hash is returned.

Authentication is stateless JWT without refresh-token persistence or revocation. Access tokens issued before a password change remain valid until expiry. Subsequent logins require the new password.

## Public Companies

Public company APIs do not require authentication. They expose `VERIFIED` companies only. `PENDING` and `BLOCKED` companies are hidden and company detail for those statuses returns `404`.

Privacy decisions:

- `taxCode`, `phone`, and internal user data are not returned by public endpoints.
- `companySize` and `logoUrl` are returned as nullable placeholders and are currently `null`.
- Public `location` filtering uses the existing company `address` field.
- `openJobs` counts `ACTIVE` jobs only.

### GET `/api/public/companies`

Role: public.

Query parameters: `keyword`, `location`, `industry`, `page`, `size`, `sort`.

Allowed sort fields: `id`, `companyName`, `industry`, `address`, `createdAt`, `updatedAt`. Default sort: `createdAt,desc`.

Response data: `PageResponse<PublicCompanyResponse>`.

Response item fields: `id`, `companyName`, `industry`, `address`, `websiteUrl`, `description`, `status`, `openJobs`, `createdAt`, `updatedAt`, `companySize`, `logoUrl`.

### GET `/api/public/companies/{id}`

Role: public.

Returns a verified company and its active jobs ordered by `publishedAt` descending.

Response company fields: `id`, `companyName`, `industry`, `address`, `websiteUrl`, `description`, `status`, `openJobs`, `createdAt`, `updatedAt`, `companySize`, `logoUrl`, `jobs`.

Job summary fields: `id`, `title`, `location`, `jobType`, `workingModel`, `status`, `salaryMin`, `salaryMax`, `currency`, `deadline`, `publishedAt`.

## Public Statistics

### GET `/api/public/statistics`

Role: public. No JWT is required.

Returns platform-wide public statistics in the standard `ApiResponse` envelope:

```json
{
  "success": true,
  "message": "Success",
  "errorCode": null,
  "data": {
    "totalJobs": 125,
    "totalCompanies": 18,
    "totalStudents": 420,
    "totalApplications": 932
  }
}
```

Response semantics:

- `totalJobs`: jobs with status `ACTIVE` whose company is `VERIFIED` and whose deadline is null, today, or in the future.
- `totalCompanies`: companies with status `VERIFIED`.
- `totalStudents`: students whose associated user has status `ACTIVE`.
- `totalApplications`: all application records, including `WITHDRAWN` applications.

An empty database returns zero for all four fields. The response contains only aggregate counts and never returns personal data, credentials, CV metadata, filenames, or storage paths.

## Public Jobs

Public job APIs require no authentication. A job is visible only when its status is `ACTIVE`, its company is `VERIFIED`, and its deadline is null, today, or later. Every non-active status, a non-verified company, or a past deadline hides the job. Hidden detail and absent ids both return `404 RESOURCE_NOT_FOUND`.

### GET `/api/public/jobs`

Role: public.

Query parameters:

- `keyword`: case-insensitive partial match across title, description, and requirements.
- `location`: case-insensitive partial match.
- `jobType`: `JobType` enum.
- `workingModel`: `WorkingModel` enum.
- `page`: 1-based, default `1`.
- `size`: default `10`, maximum `100`.

Public status filtering is not supported. Supplying `status` returns `400 BAD_REQUEST`.

Ordering is `publishedAt,desc`, then `createdAt,desc`. Response data is `PageResponse<PublicJobResponse>`.

List item fields: `id`, `companyId`, `companyName`, `title`, `location`, `jobType`, `workingModel`, `salaryMin`, `salaryMax`, `currency`, `deadline`, `skills`, `publishedAt`.

Skill fields: `skillId`, `skillName`, `category`, `importance`, `minLevel`. Internal entity and normalized skill fields are not returned.

### GET `/api/public/jobs/{jobId}`

Role: public.

Applies the exact list visibility rules. Response data contains all public list fields plus `description`, `requirements`, and `benefits`.

## Student

### GET / PUT `/api/students/me/profile-aggregate`

Role: `STUDENT`; ownership always comes from JWT, never from request IDs. GET returns one PostgreSQL repeatable-read snapshot in `ApiResponse<StudentProfileAggregateResponse>`: `{revision, student, profile, skills}`. `student`/`profile` reuse the legacy response fields below; `skills` contains the full confirmed skill list, including non-MANUAL sources. Response header `ETag: "N"` identifies the shared profile revision. CORS exposes ETag.

PUT example (one atomic mutation):

```json
{
  "revision": 7,
  "student": {"fullName": "Synthetic Student", "phone": "", "major": "Software"},
  "profile": {"summary": "Updated summary", "education": "Line one\nLine two"},
  "manualSkills": [{"skillId": 1, "proficiencyLevel": "INTERMEDIATE", "yearsOfExperience": 1, "source": "MANUAL"}],
  "clearFields": ["graduationYear"]
}
```

- `revision` is required, a nonnegative JSON integer. Missing/null/negative/fractional/string versions return 400. Successful PUT returns the complete committed snapshot at `N+1`, HTTP 200, ETag `"N+1"`.
- PUT uses the body revision as its precondition. PostgreSQL compares and increments it as the first write in the same transaction as all User/Student/Profile/skills/catalog changes. Competing aggregate **or legacy** requests cannot both claim N; stale → **409 PROFILE_REVISION_CONFLICT**. Any failure rolls back business rows and revision, including newly created catalog skills.
- Optional `student` fields: `fullName`, `phone`, `major`, `university`, `graduationYear`, `location`, `headline`. Optional `profile` fields: `summary`, `education`, `experience`, `projects`, `targetPosition`, `preferredLocation`, `preferredJobType`. Existing Jakarta length/year/enum validation applies. IDs, email, GPA, certificates, links, languages and other unsupported top-level/basic/profile properties are rejected (400).
- Omitted/null groups or scalar values mean **keep**. Blank/empty optional text means **clear to null**, preserving legacy trim semantics. Blank fullName means keep (cannot clear the required stored name).
- `clearFields` explicitly clears nullable `graduationYear` and/or `preferredJobType`; null/omitted means no clears. Unknown clear fields or simultaneously setting a non-null value and clearing it return 400. Existing unsupported columns remain unchanged. Empty groups/revision-only saves do not rewrite profile fields/timestamps.
- `manualSkills` omitted/null means keep all skill rows. A supplied list replaces **only MANUAL** rows; `[]` removes only MANUAL rows. Items use the legacy skill-item format (ID or normalized custom name, level, optional years, source MANUAL). Non-MANUAL rows are retained unchanged; attempting to replace one by a MANUAL item with the same catalog ID/name returns 400. This API cannot assign CV_EXTRACTED/ADMIN_SEEDED provenance. Actual CV analysis remains separate in `cv_files` and is never modified.
- Every successful mutation, including no-op/revision-only, advances the owned profile revision exactly once. GET does not. Profile search text/completeness retain their existing derived-field rules. Shared catalog metadata is read for display; profile revision covers owned profile state, not administrative catalog-edit history.

### Legacy profile preconditions — breaking precondition, unchanged bodies

The following three GET/PUT URLs and JSON request/response bodies remain available: `/api/students/me`, `/api/students/me/profile`, `/api/students/me/skills`. **All three legacy PUTs now require `If-Match: "N"` from the snapshot the consumer edited.** GET and successful PUT return the shared ETag without adding a revision field to legacy JSON bodies.

- Missing If-Match → **428 PROFILE_REVISION_REQUIRED**.
- Well-formed stale revision → **409 PROFILE_REVISION_CONFLICT** (application concurrency contract; this API uses 409 consistently rather than 412).
- Malformed, weak, wildcard, multiple or out-of-range ETags → 400 BAD_REQUEST. No unconditional overwrite is supported.
- Success → 200 with original body shape, ETag N+1. Legacy writes use the same transactional PostgreSQL compare-and-swap as aggregate PUT; subsequent stale aggregate/legacy writes fail. Validation/authorization may reject a request before precondition evaluation.
- This is an intentional breaking **precondition** for external clients without If-Match. All repository consumers are updated: main editor uses aggregate PUT; Preferences/Settings retain their captured ETag; setup uses aggregate; regression callers supply explicit revisions. No external consumer is identified in this repository; external deployment clients require coordination before rollout. Never fetch a new ETag automatically immediately before overwriting an old draft or silently retry a conflict with a new revision.

See [design, rollback/concurrency evidence and limitations](datn/student-profile-atomic-save-results.md).

### GET `/api/students/me`

Role: `STUDENT`.

Returns current student account/profile summary.

### PUT `/api/students/me`

Role: `STUDENT`.

Request fields: `fullName`, `major`, `university`, `phone`, `graduationYear`, `location`, `headline`.

If-Match is required as above. Omitted/null values keep existing data. Optional text empty/blank clears to null; fullName blank keeps existing. graduationYear null keeps existing; use aggregate clearFields for an explicit clear.

### GET `/api/students/me/profile`

Role: `STUDENT`.

Returns confirmed structured student profile fields, including `preferredJobType`, `rawText`, `processedText`, and `profileCompleteness`.

### PUT `/api/students/me/profile`

Role: `STUDENT`.

Request fields: `summary`, `education`, `experience`, `projects`, `targetPosition`, `preferredLocation`, `preferredJobType`.

If-Match is required as above. Omitted/null values keep existing data; empty/blank text clears to null. preferredJobType null keeps existing; aggregate clearFields supports explicit clearing.

## Student Skills

### GET `/api/students/me/skills`

Role: `STUDENT`.

Returns confirmed student skills.

Response item:

```json
{
  "studentSkillId": 1,
  "skillId": 1,
  "skillName": "Java",
  "normalizedName": "java",
  "category": "Backend",
  "proficiencyLevel": "INTERMEDIATE",
  "yearsOfExperience": 1.5,
  "source": "MANUAL"
}
```

### PUT `/api/students/me/skills`

Role: `STUDENT`.

Replace semantics: the request is the student's complete confirmed current skill list. Existing skills are updated, new skills are created, and omitted skills are removed.

If-Match is required. These existing legacy replace semantics include all confirmed provenance labels; `[]` clears the confirmed list. They do **not** modify a CV's extractedSkills/READY analysis snapshot. The aggregate/manual editor has the narrower MANUAL-only replacement described above; no legacy provenance restriction is silently introduced.

Request:

```json
{
  "skills": [
    {
      "skillId": 1,
      "proficiencyLevel": "INTERMEDIATE",
      "yearsOfExperience": 1.5,
      "source": "MANUAL"
    }
  ]
}
```

Validation: duplicate `skillId` values are rejected, each `skillId` must exist, `yearsOfExperience` must be greater than or equal to 0, and enum strings must match the declared enum values. The request field `level` is also accepted as an alias for `proficiencyLevel`.

## Saved Jobs

### POST `/api/students/me/saved-jobs/{jobId}`

Role: `STUDENT`.

Saves an active job for the current student. Duplicate saves are rejected.

### GET `/api/students/me/saved-jobs?page=1&size=10`

Role: `STUDENT`.

Returns paged saved jobs.

Response item:

```json
{
  "savedJobId": 1,
  "jobId": 10,
  "title": "Backend Developer Intern",
  "companyName": "Demo Tech Company",
  "location": "Ho Chi Minh City",
  "jobType": "INTERNSHIP",
  "workingModel": "HYBRID",
  "status": "ACTIVE",
  "savedAt": "2026-07-15T10:00:00"
}
```

### DELETE `/api/students/me/saved-jobs/{jobId}`

Role: `STUDENT`.

Removes the current student's saved job. Missing saved rows return not found.

## Student Saved Searches

All saved-search endpoints require role `STUDENT`. Ownership always comes from the authenticated user's student record; `studentId`, `userId`, and other unknown request properties are rejected.

Response fields: `id`, `name`, `keyword`, `location`, `jobType`, `workingModel`, `createdAt`, `updatedAt`.

### GET `/api/students/me/saved-searches`

Returns `ApiResponse<List<SavedSearchResponse>>` for the authenticated student, ordered by `updatedAt,desc`, then `id,desc`.

### POST `/api/students/me/saved-searches`

Request:

```json
{
  "name": "Java internships in HCM",
  "keyword": "Java",
  "location": "Ho Chi Minh City",
  "jobType": "INTERNSHIP",
  "workingModel": "ONSITE"
}
```

`name` is required after trimming and has a maximum of 100 characters. Optional `keyword` and `location` are limited to 255 characters. Optional enums must be known `JobType` and `WorkingModel` values. Text is trimmed and blank optional text is stored as null.

Names are unique per student without regard to case. A duplicate returns `409 SAVED_SEARCH_ALREADY_EXISTS`; another student may use the same name.

### PUT `/api/students/me/saved-searches/{savedSearchId}`

Full replacement using the same request and validation as POST. Ownership never changes. A foreign or absent id returns the same `404 SAVED_SEARCH_NOT_FOUND`.

### DELETE `/api/students/me/saved-searches/{savedSearchId}`

Deletes only the authenticated student's saved-search record. A foreign or absent id returns `404 SAVED_SEARCH_NOT_FOUND`.

## Company

### GET `/api/companies/me/dashboard-summary?days=30`

COMPANY only, JWT-derived owner, including internal management for PENDING/BLOCKED
Companies. No client ownership/sort parameters; unsupported/duplicate query keys
return400. `days` must be7/30/90 (default30), invalid400. `ApiResponse<Dashboard>`:

- `jobCounts` for all six persisted Job statuses and `totalJobs`: all owned Jobs,
  independent of public visibility and the trend period.
- `summary.totalApplications`, `uniqueStudents`, five `statusCounts`, `acceptedRate`:
  all owned application **history rows**. Reapplications count separately; unique
  students are DISTINCT student_id. Rate is current ACCEPTED/all histories×100,
  including WITHDRAWN, HALF_UP2 decimals; zero denominator returns null.
- `trendFrom`,`trendTo`,`timeZone="UTC"`,`trend[{bucket,applications}]`: exactly
  N UTC calendar dates ending today inclusive, filled zero dates.
- `topJobs`: top10 owned Jobs by history count DESC, jobId ASC, including count,
  accepted and rate; this is an explicitly limited leaderboard, not all Jobs.
- `recentApplications`: PageResponse with page1/size5/full all-time total and
  latest5 rows ordered appliedAt DESC,id DESC. `expiringJobCount` counts owned
  ACTIVE Jobs with deadline in [today,today+14] inclusive; `expiringJobs` contains
  first5 by deadline ASC,id ASC. Null/past deadlines excluded.

### GET `/api/companies/me/recruitment-report`

COMPANY only. Optional `from`,`to` ISO calendar dates (years1–9998, from≤to),
positive `jobId`, `status` PENDING/REVIEWED/ACCEPTED/REJECTED/WITHDRAWN, literal
case-insensitive `keyword`≤255 (Student name/email, Job title, original CV filename),
page≥1/size1–100 default1/10. All filters combine before database aggregation/count/
LIMIT/OFFSET. `%`, `_`, backslash are literal keyword characters. Missing/foreign
Job filter404; role403; unauth401; invalid/unknown/duplicate parameters400.

Response `ApiResponse<Report>` includes normalized `scope` (from/to/jobId/status/
keyword/timeZone), `summary` with the definitions above applied to the **full filtered
set**, monthly nonempty `trend`, `topJobs`+`topJobLimit=10`, `applications` PageResponse.
Application rows contain IDs, name/email, Job title/status, applied/reviewed timestamps,
original CV filename; never hashes, stored filenames or internal paths. Empty result:
five status zeros, total/unique0, rate null, empty trend/items. Out-of-range page may
have empty items with unchanged filtered total. No dataset snapshot across page requests.

Dates explicitly use UTC stored-calendar convention, `[from 00:00,to+1 00:00)` on
applied_at. TIMESTAMP WITHOUT TIME ZONE columns have no historical source offset;
analytics does not reinterpret/rewrite legacy rows or assume host timezone. Historical
non-UTC producers require a separate reviewed migration to recover/standardize offsets.
All queries for a single response execute in one read-only REPEATABLE_READ transaction.
Current statuses are reported; there is no accepted-at audit cohort metric.

### GET `/api/companies/me/recruitment-report/export`

Same authenticated scope/filters as report, excluding page/size. JSON
`ApiResponse<{scope,rowCount,encoding:"UTF-8",maxRows:10000,csv}>`, preserving the
JSON API envelope; browser downloads the CSV string. **Full filtered dataset**,
appliedAt DESC,id DESC. Count>10000 returns422 `REPORT_EXPORT_LIMIT_EXCEEDED`,
without truncation. Count/export share one read-only transaction snapshot. A separate
export request can observe changes since the previous report; rowCount is authoritative
for that export. No background export job.

CSV columns: applicationId,studentId,studentName,studentEmail,jobId,jobTitle,status,
appliedAt,reviewedAt,cvFileName. UTF-8 BOM, CRLF, double-quoted/escaped cells and
embedded newlines. Text starting with =,+,-,@ after leading whitespace, or starting
tab/CR/LF, is prefixed with apostrophe for spreadsheet safety. CSV contains owned
PII, requires authentication and Company authorization; never commit real downloads.
No Job/Application state mutation, migration, scoring or notification change.

Runtime/SQL evidence: [Company Dashboard & Reports](datn/company-dashboard-reports-results.md).

### GET `/api/companies/me/jobs`

Role: `COMPANY`. Management list scoped exclusively to the authenticated User's Company, including PENDING/BLOCKED Companies. Company ownership is resolved by Backend; client `companyId`, `userId`, `sort`, and other unknown query parameters return 400 `BAD_REQUEST`.

Optional query parameters: `page` (1-based, default 1, minimum 1), `size` (default 10, range 1–100), `keyword` (case-insensitive substring of title, description or requirements), `status`, `jobType`, `workingModel`, `location` (case-insensitive substring). Enum values follow the shared Job enums. Invalid pagination/enums return 400. Filters combine with AND and run in PostgreSQL before pagination and counting.

Response: `ApiResponse<PageResponse<JobResponse>>`, ordered by `createdAt DESC, id DESC`. No total-result limit of 100. All six own Job statuses are readable. `totalItems` counts all matching own Jobs and `totalPages = ceil(totalItems / size)`. Empty matches return `items: []`, `totalItems: 0`, `totalPages: 0`; out-of-range pages return 200 with empty items, the requested page and accurate totals. Offset pages have deterministic ordering for an unchanged dataset; they do not provide a cross-request snapshot during concurrent inserts/deletes.

Student/Admin receive 403; unauthenticated requests follow the existing security entry point. This endpoint grants no foreign Job detail or write access and no publishing rights. Existing generic `/api/jobs`, public discovery, moderation, Recommendation V3 and Candidate Ranking V3 semantics remain unchanged.

### GET `/api/companies/me`

Role: `COMPANY`.

Returns current company profile, numeric `revision`, and strong numeric `ETag`
(for example `"0"`). This is the account draft revision, independent of Student
profile and Saved Candidate revisions.

### PUT `/api/companies/me`

Role: `COMPANY`.

Request fields: `companyName`, `taxCode`, `description`, `website`, `address`, `phone`, `industry`.

V21 requires `If-Match` with the ETag captured when loading this draft. Missing:
428 `SETTINGS_REVISION_REQUIRED`; malformed/weak/wildcard/multiple/negative or
overflowing ETag: 400 `BAD_REQUEST`; stale: 409 `SETTINGS_REVISION_CONFLICT`.
Each successful write increments the account revision once, including no-op
field values, and returns the new `revision` and ETag. The existing Company row
lock still serializes profile writes with verification/status changes. Conflicts
do not mutate fields or revision. The client keeps its draft and must explicitly
review/replace it before using a newly fetched revision; never GET-and-retry an
old draft automatically. No Company verification authority is added.

## Recruiter Candidate Ranking

The recruiter Candidate Ranking endpoints are documented in the locked
[active V3 contract](recommendation-ranking-v3-contract.md); the [V2 Candidate Ranking contract](candidate-ranking-contract.md) describes compatibility/history. The V3 contract covers
eligibility, the Backend-to-AI internal request, scoring strategies, response
validation, rank assignment, persistence, and error behavior:

- POST /api/companies/me/jobs/{jobId}/candidate-ranking-runs
- GET /api/companies/me/jobs/{jobId}/candidate-ranking-runs?page=1&size=20
- GET /api/companies/me/jobs/{jobId}/candidate-ranking-runs/{runId}

The Frontend calls these Backend endpoints only. The AI internal endpoint is
not a public API and requires the shared internal API key.

## Recruiter Saved Candidates

All saved-candidate APIs require role `COMPANY` and operate only on the authenticated company.

### GET `/api/companies/me/saved-candidates`

Returns `ApiResponse<PageResponse<SavedCandidateResponse>>`.

Query parameters:

- `keyword`: optional case-insensitive literal partial match against student full name, student email, university, major, headline, the saved application's job title, or the Company's private note; maximum length 255. `%`, `_` and backslash are literal characters.
- `studentId`, `jobId`: optional positive IDs, applied inside the authenticated Company's scope before count/pagination. A foreign/nonexistent filter yields an empty list.
- `applicationStatus`: optional `PENDING`, `REVIEWED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, read directly from the saved **source application**. A bookmark remains tied to its original source after a later reapplication; this is not a candidate-wide lifecycle status.
- `page`: 1-based page number, default `1`.
- `size`: page size from 1 through 100, default `10`.
- `sort`: accepts `field,asc`, `field,desc`, `field:asc`, or `field:desc`; maximum length 100.

Allowed sort fields: `id`, `createdAt`, `updatedAt`. Default sort: `createdAt,desc`, with `id DESC` as a deterministic tie-breaker. Unsupported fields or directions return `400 BAD_REQUEST`.

Each response item contains:

```json
{
  "id": 42,
  "applicationId": 123,
  "applicationStatus": "PENDING",
  "revision": 0,
  "studentId": 15,
  "studentName": "Nguyen Van A",
  "studentEmail": "student@example.com",
  "university": "Example University",
  "major": "Software Engineering",
  "headline": "Java Backend Intern",
  "jobId": 9,
  "jobTitle": "Backend Developer Intern",
  "cvFileId": 31,
  "cvFileName": "nguyen-van-a-resume.pdf",
  "note": "Strong backend profile",
  "savedAt": "2026-07-23T10:00:00",
  "updatedAt": "2026-07-23T10:00:00"
}
```

The list is company-scoped. It never returns CV physical paths, file URLs, stored filenames, password hashes, or internal user data.

### POST `/api/companies/me/saved-candidates`

Request:

```json
{
  "applicationId": 123,
  "note": "Optional recruiter note"
}
```

`applicationId` is required and positive. `note` is optional, trimmed, and limited to 2,000 characters. Unknown request fields are rejected; in particular, `studentId` cannot be supplied.

The backend derives the student from the application and creates no application status change. The application's job must belong to the authenticated company; otherwise the request returns `403 ACCESS_DENIED`. Saving the same student twice for one company returns `409 SAVED_CANDIDATE_ALREADY_EXISTS`, even when the student has applications to multiple company jobs.

Withdrawn applications remain saveable because the current application domain does not prohibit recruiter bookmarking after withdrawal.

Response data: the created `SavedCandidateResponse`.

### PATCH `/api/companies/me/saved-candidates/{id}/note`

Role `COMPANY`. Body: `{ "note": "Internal assessment", "revision": 0 }`. `revision` is required, nonnegative and must equal the revision captured with the draft. `note` is nullable/optional, trimmed, maximum 2,000 characters; null/blank clears it. Unknown fields return `400 BAD_REQUEST`. Success is `200` with the updated `SavedCandidateResponse`. A changed note increments the persisted revision; an unchanged note may retain it.

Missing/foreign bookmark: `404 SAVED_CANDIDATE_NOT_FOUND`. Stale draft: `409 SAVED_CANDIDATE_REVISION_CONFLICT`, with no mutation. Frontend retains the draft, offers explicit read-back/compare and never automatically retries with a freshly fetched revision. Notes are Company-internal; Student and other Companies cannot read or write them. No application status, CV analysis or ranking changes occur.

Existing policy permits PENDING/BLOCKED Companies to manage their own existing applicants/bookmarks; verification gates Job publication/public visibility, not these internal operations. An inactive/blocked **User** remains subject to authentication policy. Missing/invalid authentication is 401, wrong role is 403. Simultaneous duplicate saves return one 200/one 409; simultaneous deletes of the same bookmark return one 200/one 404.

### DELETE `/api/companies/me/saved-candidates/{id}`

Deletes only the saved-candidate bookmark owned by the authenticated company. An absent id and another company's id both return `404 SAVED_CANDIDATE_NOT_FOUND`, so ownership is not disclosed.

This operation does not delete or change the student, application, CV, job, or application status.

## Admin Users

All admin user APIs require role `ADMIN`. `passwordHash` is never returned.

### GET `/api/admin/users`

Role: `ADMIN`.

Query parameters: `role`, `fullName`, `keyword`, `status`, `page`, `size`, `sort`.

Enum values:

- `role`: `STUDENT`, `COMPANY`, `ADMIN`
- `status`: `ACTIVE`, `INACTIVE`, `BLOCKED`

Allowed sort fields: `id`, `email`, `fullName`, `role`, `status`, `lastLoginAt`, `createdAt`, `updatedAt`. Default sort: `createdAt,desc`.

Response data: `PageResponse<AdminUserResponse>`.

Response item fields: `id`, `email`, `fullName`, `phone`, `role`, `status`, `lastLoginAt`, `createdAt`, `updatedAt`.

### GET `/api/admin/users/{id}`

Role: `ADMIN`.

Returns base user information plus a profile summary when it exists. This GET does not create a missing student or company profile.

Base fields: `id`, `email`, `fullName`, `phone`, `role`, `status`, `lastLoginAt`, `createdAt`, `updatedAt`.

Student summary field: `studentProfile` with `studentId`, `studentCode`, `university`, `major`, `graduationYear`, `location`, `profileId`, `headline`, `targetPosition`, `profileCompleteness`, `createdAt`, `updatedAt`, or `null`.

Company summary field: `companyProfile` with `companyId`, `companyName`, `taxCode`, `websiteUrl`, `industry`, `description`, `address`, `phone`, `status`, `companySize`, `logoUrl`, `createdAt`, `updatedAt`, or `null`. `companySize` and `logoUrl` are nullable placeholders.

### PATCH `/api/admin/users/{id}/status`

Role: `ADMIN`.

Request:

```json
{
  "status": "ACTIVE"
}
```

Allowed values: `ACTIVE`, `INACTIVE`, `BLOCKED`.

Rules:

- Returns updated `AdminUserResponse`.
- Does not change password or role.
- The authenticated admin cannot set their own status to `INACTIVE` or `BLOCKED`.
- Once a user is `INACTIVE` or `BLOCKED`, existing JWTs for that user are rejected by the JWT filter.

## Admin Companies

All admin company APIs require role `ADMIN`.

### GET `/api/admin/companies`

Role: `ADMIN`.

Query parameters: `keyword`, `companyName`, `taxCode`, `industry`, `status`, `page`, `size`, `sort`.

`companySize` filtering is not supported in Phase 1.

Enum values:

- `status`: `PENDING`, `VERIFIED`, `BLOCKED`

Allowed sort fields: `id`, `companyName`, `taxCode`, `industry`, `status`, `createdAt`, `updatedAt`. Default sort: `createdAt,desc`.

Response data: `PageResponse<AdminCompanyResponse>`.

Response item fields: `id`, `userId`, `email`, `companyName`, `taxCode`, `websiteUrl`, `industry`, `description`, `address`, `phone`, `status`, `openJobs`, `createdAt`, `updatedAt`, `companySize`, `logoUrl`.

`openJobs` counts `ACTIVE` jobs only. `companySize` and `logoUrl` are nullable placeholders.

### GET `/api/admin/companies/{id}`

Role: `ADMIN`.

Returns `AdminCompanyResponse` with the full supported company detail fields listed above. No jobs array is included in Phase 1.

### PATCH `/api/admin/companies/{id}/status`

Role: `ADMIN`.

Request:

```json
{
  "status": "VERIFIED"
}
```

Allowed values: `PENDING`, `VERIFIED`, `BLOCKED`.

Rules:

- Returns updated `AdminCompanyResponse`.
- Does not automatically modify the associated `User.status`.
- Does not create notifications or a separate approval workflow.
- All transitions between `PENDING`, `VERIFIED`, `BLOCKED` are Admin-only; same-state requests return 200. Company cannot verify/unblock itself.
- No Job rows are rewritten. Removing verification immediately hides existing ACTIVE jobs through visibility filters; reverifying restores still-ACTIVE, unexpired jobs. Applications/CVs/history remain intact.

## Skills

### GET `/api/skills?page=1&size=20&keyword=java&category=Backend`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Returns paged skill catalog data.

### GET `/api/skills/{id}`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

### POST `/api/skills`

Role: `ADMIN`.

Request fields: `name`, `category`, `description`.

### PUT `/api/skills/{id}`

Role: `ADMIN`.

Request fields: `name`, `category`, `description`.

## Jobs

### GET `/api/jobs?page=1&size=10`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Filters: `keyword`, `location`, `jobType`, `workingModel`, `status`, `page`, `size`.

Visibility:

- `STUDENT` sees ACTIVE jobs from VERIFIED Companies.
- `COMPANY` sees ACTIVE jobs from VERIFIED Companies plus its own jobs in all states.
- `ADMIN` sees active jobs by default unless `status` is provided.

### GET `/api/jobs/{id}`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Students can view ACTIVE jobs from VERIFIED Companies. Companies can view those jobs and their own jobs in all states. Admin can view all jobs. Generic authenticated job APIs retain their existing deadline semantics; public search/detail additionally require deadline null/today/future.

### POST `/api/jobs`

Roles: `COMPANY`, `ADMIN`.

Company-created jobs always belong to the current company. Admin must provide `companyId`.

Request fields: `companyId`, `title`, `description`, `requirements`, `benefits`, `location`, `jobType`, `workingModel`, `status`, `salaryMin`, `salaryMax`, `currency`, `deadline`, `skills`.

Job skill item fields: `skillId`, `importance`, `minLevel`.

Validation: `salaryMin <= salaryMax`, duplicate job skill IDs are rejected, and `jobType=REMOTE` is invalid.

Creation permits only DRAFT (default) or PENDING_APPROVAL. Any Company verification state can save DRAFT; PENDING_APPROVAL requires VERIFIED (otherwise 403). Company targets ACTIVE/REJECTED/EXPIRED return 403; other unsupported creation statuses return 400. Admin must also create DRAFT/PENDING_APPROVAL and review an existing pending Job before activation.

### PUT `/api/jobs/{id}`

Roles: `COMPANY`, `ADMIN`.

Company users can update only their own jobs. Admin can update all jobs.

Content updates require DRAFT for both roles (other states: 400). `status` is not a content field; unknown fields, including `status`, return 400. Explicitly withdraw/close/return to DRAFT before editing; saving content never implicitly unpublishes a Job.

### PATCH `/api/jobs/{id}/status`

Roles: `COMPANY`, `ADMIN`.

Request:

```json
{
  "status": "ACTIVE"
}
```

The example is Admin-only for a PENDING_APPROVAL Job owned by a VERIFIED Company. State machine:

- COMPANY owner / ADMIN: DRAFT → PENDING_APPROVAL (VERIFIED only), PENDING_APPROVAL → DRAFT, REJECTED/CLOSED/EXPIRED → DRAFT, any state → CLOSED.
- ADMIN only: PENDING_APPROVAL → ACTIVE (VERIFIED only), PENDING_APPROVAL → REJECTED, ACTIVE → EXPIRED.
- Allowed same-state calls are idempotent. Company can never target ACTIVE/REJECTED/EXPIRED, including no-ops (403). ACTIVE/PENDING_APPROVAL targets always require VERIFIED (403).
- All other edges return 400; wrong role/ownership returns 403. CLOSED cannot reopen directly to ACTIVE; it must return to DRAFT and be reviewed again. Competing review/verification writes are serialized with database row locks.

See the complete [moderation policy and transition table](datn/company-job-moderation-policy.md). `publishedAt` remains first publication; `closedAt` is set on entering CLOSED and cleared on leaving it; no-ops do not rewrite timestamps.

### DELETE `/api/jobs/{id}`

Roles: `COMPANY`, `ADMIN`.

Soft-closes the job by setting status to `CLOSED`.

## Applications

### POST `/api/jobs/{jobId}/apply`

Role: `STUDENT`.

Request fields: `cvFileId`, `coverLetter`.

Rules: Job must be ACTIVE with a VERIFIED Company, deadline null/today/future (otherwise 400); supplied CV must belong to the authenticated Student. CV is optional and apply does not require READY analysis.

An existing PENDING/REVIEWED/ACCEPTED row for the pair returns `409 APPLICATION_ALREADY_ACTIVE`. If none exists, first apply is allowed; reapply requires latest history by appliedAt DESC, id DESC to be REJECTED. Latest WITHDRAWN returns `400 BAD_REQUEST` with message `Reapplication is only allowed after the latest application was rejected`. Reapply inserts a new PENDING record and preserves old rejected history. V18 enforces active-pair uniqueness with a partial index, not lifetime uniqueness; the latest-REJECTED rule is enforced by Backend. [Service](../backend/src/main/java/com/tttn/jobrecommendation/modules/application/service/ApplicationServiceImpl.java), [V18](../backend/src/main/resources/db/migration/V18__allow_reapplication_after_rejection.sql), and [API tests](../backend/src/test/java/com/tttn/jobrecommendation/integration/ApplicationReapplyApiIT.java) establish this behavior.

### GET `/api/students/me/applications`

Role: `STUDENT`.

Returns the current Student's full application history, optionally filtered by `jobId`, ordered by appliedAt DESC then id DESC. Multiple records for a Job can include rejected history and a new PENDING application.

### GET `/api/students/me/applications/{id}`

Role: `STUDENT`.

Returns one current-student application. Applications belonging to another student are not returned.

Response fields: `id`, `status`, `coverLetter`, `studentId`, `studentName`, `studentEmail`, `jobId`, `jobTitle`, `companyId`, `companyName`, `cvFileId`, `cvFileName`, `appliedAt`, `reviewedAt`, `createdAt`, `updatedAt`.

### GET `/api/companies/me/applications`

Role: `COMPANY`.

Returns paged applications across all jobs owned by the authenticated company.

Query parameters: `status`, `jobId`, `keyword`, `page`, `size`, `sort`.

Enum values:

- `status`: `PENDING`, `REVIEWED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`

`keyword` searches student full name, student email, and job title.

Allowed sort fields: `id`, `status`, `appliedAt`, `reviewedAt`, `createdAt`, `updatedAt`. Default sort: `appliedAt,desc`.

Response data: `PageResponse<ApplicationResponse>`.

Response item fields: `id`, `status`, `coverLetter`, `studentId`, `studentName`, `studentEmail`, `jobId`, `jobTitle`, `companyId`, `companyName`, `cvFileId`, `cvFileName`, `appliedAt`, `reviewedAt`, `createdAt`, `updatedAt`.

Only applications for the authenticated company's jobs are returned.

### GET `/api/companies/me/applications/{id}`

Role: `COMPANY`.

Returns one application if its job belongs to the authenticated company. Applications for another company are not returned. CV exposure is limited to `cvFileId` and `cvFileName`; internal `filePath` and `storedFileName` are not returned.

### GET `/api/companies/me/applications/{applicationId}/cv/file?download=false`

Role: `COMPANY`.

Streams the CV attached to an application whose job belongs to the authenticated company. The company selects an application only; a standalone CV id is never accepted.

Query parameter:

- `download`: optional boolean, default `false`. `false` returns `Content-Disposition: inline`; `true` returns `Content-Disposition: attachment`.

Successful response: `200 OK` with the raw file body, the stored `Content-Type`, and a sanitized original filename in `Content-Disposition`. The response never exposes `filePath`, `fileUrl`, `storedFileName`, the configured storage directory, or an absolute path.

Errors use the standard JSON error envelope:

- `401 UNAUTHORIZED`: missing or invalid token.
- `403 ACCESS_DENIED`: wrong role or the application belongs to another company.
- `404 RESOURCE_NOT_FOUND`: the application does not exist, has no CV reference, its CV metadata or physical file is missing, or its stored filename cannot be resolved safely inside the configured CV storage directory.
- `500 INTERNAL_SERVER_ERROR`: an unexpected file-storage read fails.

### GET `/api/companies/me/jobs/{jobId}/applications`

Role: `COMPANY`.

Returns applications for a job owned by the current company.

### GET `/api/admin/applications`

Role: `ADMIN`.

Returns a paged list of all applications.

Query parameters: `status`, `studentId`, `jobId`, `companyId`, `keyword`, `page`, `size`, `sort`.

- `status`: `PENDING`, `REVIEWED`, `ACCEPTED`, `REJECTED`, or `WITHDRAWN`.
- `studentId`, `jobId`, and `companyId`: exact id filters.
- `keyword`: case-insensitive partial match against student full name, student email, job title, or company name; maximum length 255.
- `page`: 1-based page number, default `1`.
- `size`: page size from 1 through 100, default `10`.
- `sort`: maximum length 100 and accepts `field,asc`, `field,desc`, `field:asc`, or `field:desc`.

Allowed sort fields: `id`, `status`, `appliedAt`, `reviewedAt`, `createdAt`, `updatedAt`. Default sort: `appliedAt,desc`.

Response data: `PageResponse<ApplicationResponse>`.

Each item contains `id`, `status`, `coverLetter`, `studentId`, `studentName`, `studentEmail`, `jobId`, `jobTitle`, `companyId`, `companyName`, `cvFileId`, `cvFileName`, `appliedAt`, `reviewedAt`, `createdAt`, and `updatedAt`. Internal CV paths are never returned.

Errors: `401 UNAUTHORIZED`, `403 ACCESS_DENIED`, `400 VALIDATION_ERROR` for invalid query values, and `400 BAD_REQUEST` for an unsupported sort field or direction.

### GET `/api/admin/applications/{applicationId}`

Role: `ADMIN`.

Returns one `ApplicationResponse` with the safe fields listed above. It never returns `filePath`, `fileUrl`, or `storedFileName`.

Errors: `401 UNAUTHORIZED`, `403 ACCESS_DENIED`, or `404 RESOURCE_NOT_FOUND` when the application is absent.

### PATCH `/api/applications/{id}/status`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Request field: `status`.

Company/Admin transitions: `PENDING -> REVIEWED`, `PENDING|REVIEWED -> ACCEPTED|REJECTED`.

Student transition: `PENDING -> WITHDRAWN`.

Status mutation acquires a PostgreSQL pessimistic lock on the application row before ownership/state validation, and holds it through status write and notification persistence in the same transaction. Concurrent withdraw/review cannot both validate an old PENDING state: one succeeds (200), the other rechecks the committed state and returns 400 `BAD_REQUEST`. This is state-machine serialization, not a new revision/ETag contract. Duplicate withdrawal returns 400; no terminal status can be reopened. Foreign Student/Company mutation returns 403; Student targeting ACCEPTED/REJECTED returns 403, other unsupported transitions return 400.

Company/Admin successful status changes notify the owning Student only when their application-status notification preference is enabled. Student withdrawal and apply/reapply do not create that notification; rejected/foreign/duplicate operations create none. Existing notification settings and transaction rollback behavior remain authoritative.

Frontend withdrawal is available on Student list/detail/status only for PENDING, with explicit confirmation that WITHDRAWN blocks future reapply. Network failure retains confirmed data; a GET read-back reconciles ambiguous results before an explicit retry. No automatic mutation retry. Application state is scoped to authenticated User; focus/cross-tab invalidations refetch Backend, and unverified history never means NEVER_APPLIED. Apply UI offers READY CVs (or the existing optional no-CV choice); Backend apply still accepts an owned CV without a READY requirement as documented above.

## CV

### POST `/api/students/me/cv?active=true`

Role: `STUDENT`.

Multipart request part: `file`. Supported extensions/content types are PDF and DOCX. The current implementation stores metadata and an internal file location; it does not extract text. Responses expose safe metadata only and omit internal `filePath` and `storedFileName`.

### GET `/api/students/me/cv`

Role: `STUDENT`.

Lists the current student's CV files with safe metadata only.

### GET `/api/students/me/cv/active`

Role: `STUDENT`.

Returns the active CV or `null`.

### GET `/api/students/me/cv/{id}`

Role: `STUDENT`.

Returns one CV owned by the authenticated student. CVs belonging to another student are not returned.

Safe response fields: `id`, `studentId`, `fileName`, `originalFileName`, `contentType`, `fileSize`, `extractedText`, `processedText`, `isActive`, `uploadedAt`, `createdAt`, `updatedAt`.

`fileUrl` is not returned because the stored value is an internal relative upload path, not a confirmed safe client-accessible URL. `filePath` and `storedFileName` are never returned.

### GET `/api/students/me/cv/{cvId}/file?download=false`

Role: `STUDENT`.

Streams a CV owned by the authenticated student. A CV belonging to another student is intentionally indistinguishable from a missing CV.

Query parameter:

- `download`: optional boolean, default `false`. `false` returns `Content-Disposition: inline`; `true` returns `Content-Disposition: attachment`.

Successful response: `200 OK` with the raw file body, the stored `Content-Type`, and a sanitized original filename in `Content-Disposition`. The file is streamed without loading the full contents into memory. The response never exposes `filePath`, `fileUrl`, `storedFileName`, the configured storage directory, or an absolute path.

Errors use the standard JSON error envelope:

- `401 UNAUTHORIZED`: missing or invalid token.
- `403 ACCESS_DENIED`: wrong role.
- `404 RESOURCE_NOT_FOUND`: the CV does not exist, is not owned by the current student, its physical file is missing, or its stored filename cannot be resolved safely inside the configured CV storage directory.
- `500 INTERNAL_SERVER_ERROR`: an unexpected file-storage read fails.

### DELETE `/api/students/me/cv/{cvId}`

Role: `STUDENT`.

Deletes the current student's unused CV metadata and physical file. A CV belonging to another student is intentionally indistinguishable from a missing CV.

Success: `200 OK` with `ApiResponse<Void>`, message `CV deleted successfully`, and `data: null`.

Rules:

- A CV referenced by any application is not deleted; the API returns `409 Conflict` with error code `CV_IN_USE`.
- Other protected database references also prevent deletion and return `CV_IN_USE`.
- An active CV may be deleted when it is unused.
- Deleting an active CV does not activate another CV automatically.
- If the physical file is already absent, deleting its stale metadata is allowed.
- A physical-file deletion failure is reported as an error and must not be presented as a successful deletion.

Errors: `401 UNAUTHORIZED`, `403 ACCESS_DENIED` for the wrong role, `404 RESOURCE_NOT_FOUND` for missing/non-owned metadata or an unsafe/non-regular stored path, `409 CV_IN_USE` for a protected database reference, and `500 INTERNAL_SERVER_ERROR` for a file deletion failure.

### PATCH `/api/students/me/cv/{id}/active`

Role: `STUDENT`.

Request body: none.

Sets the selected CV as active transactionally and deactivates any other active CV for the same student. Re-selecting the currently active CV is idempotent. Old CV records are not deleted.

Response data: safe CV metadata with the fields listed above.

### GET `/api/students/me/cv/{cvId}/analysis`

Role: `STUDENT`.

Returns analysis data only for a CV owned by the authenticated student. Foreign and absent CV identifiers return the same `404 RESOURCE_NOT_FOUND` envelope.

Response data:

```json
{
  "cvId": 12,
  "extractedText": "Original extracted text",
  "processedText": "java spring boot postgresql",
  "skills": ["java", "postgresql", "spring boot"],
  "status": "READY",
  "analysisError": null,
  "languageCode": "en",
  "languageConfidence": 0.98,
  "processingVersion": "bilingual-nlp-v2-skills-v1",
  "warnings": [],
  "analyzedAt": "2026-07-24T10:05:00",
  "uploadedAt": "2026-07-24T10:00:00",
  "updatedAt": "2026-07-24T10:05:00"
}
```

`status` is persisted and is one of `NOT_READY`, `PROCESSING`, `READY`, or `FAILED`. `skills` comes only from this CV's `extractedSkills`; it is not read from `student_skills`. `extractedText` must not be treated as valid analysis input while status is not `READY`. No file path, storage directory, stored filename, `studentId`, or `userId` is returned.

CV analysis transitions:

1. A newly uploaded CV is `NOT_READY`, with null text/language/version/error timestamps and empty extracted skills/warnings.
2. Reanalysis commits `PROCESSING` and resets all derived analysis before any file or HTTP work.
3. The original PDF/DOCX is loaded and sent to AI without an open database transaction.
4. A valid response is committed as `READY` with both texts, per-CV skills, language metadata, warnings, and `analyzedAt`.
5. A file-load, timeout, unavailable-AI, invalid-response, or orchestration failure is committed independently as `FAILED`. Processed text, per-CV skills, language/version metadata, warnings, and `analyzedAt` are cleared; `analysisError` contains only a sanitized safe message.

### PATCH `/api/students/me/cv/{cvId}/extracted-data`

Role: `STUDENT`.

This compatibility endpoint does not modify data in the MVP. Processing order is security-sensitive:

1. Missing or invalid authentication returns `401 UNAUTHORIZED`.
2. The backend resolves the current student and verifies CV ownership.
3. A foreign or absent CV returns the existing indistinguishable `404 RESOURCE_NOT_FOUND` response.
4. An owned CV returns `501 FEATURE_NOT_SUPPORTED`, with `data: null`.

The endpoint never updates `extractedText` or `processedText`. Unknown request fields also create no side effect. Manual extracted-data editing is unsupported because reanalysis always reloads the original PDF/DOCX and the AI `rawText` would overwrite edited text.

### POST `/api/students/me/cv/{cvId}/reanalyze`

Role: `STUDENT`.

Request body: none.

The backend verifies ownership, commits the `PROCESSING` reset, resolves the original stored CV through its storage abstraction, and uploads it as multipart field `file` to `POST /internal/v2/cv/parse`. No database transaction remains open during file loading or that HTTP call.

Contract V2 response:

```json
{
  "rawText": "Java developer...",
  "processedText": "java spring boot postgresql docker",
  "skills": ["java", "spring boot", "postgresql", "docker"],
  "languageCode": "en",
  "languageConfidence": 0.98,
  "processingVersion": "bilingual-nlp-v2-skills-v1",
  "warnings": []
}
```

The backend validates every field and persists all accepted metadata. `processedText`, `skills`, `languageCode`, `languageConfidence`, `processingVersion`, and `warnings` are required; text, collection, item, and version lengths are bounded; language confidence must be finite and within `[0,1]`; language code is normalized to lowercase and limited to `en`, `vi`, `mixed`, or `unknown`.

Skills are defensively normalized by trimming, lowercasing, collapsing whitespace, removing duplicates, and sorting. This is syntactic normalization, not semantic canonicalization. The AI service must return canonical names compatible with `skills.normalized_name`. The backend does not translate aliases, create a `skill_aliases` table, insert unknown catalog skills, or update `student_skills`. A canonical string not present in the skill catalog can still be stored in that CV's `extractedSkills`.

Semantic alias mapping belongs to the AI service and must be covered there, including:

- `học máy` / `hoc may` / `machine learning` -> `machine learning`
- `K8s` / `Kubernetes` -> `kubernetes`
- `SpringBoot` / `spring-boot` / `Spring Boot` -> `spring boot`

Timeout, connection, upstream HTTP, and malformed-response errors use the AI service codes listed above and never expose a CV body, local path, credential, remote response body, or exception class.

#### Legacy internal V1 CV parse contract

`POST /internal/v1/cv/parse` is not redefined. During staged rollout the AI service retains this response for older backend deployments:

```json
{
  "rawText": "Optional original extracted text",
  "processedText": "java spring boot postgresql docker",
  "skills": ["Java", "Spring Boot", "PostgreSQL", "Docker"]
}
```

Current Backend CV reanalysis calls only `/internal/v2/cv/parse`; Recommendation V3 does not replace parsing.

## Recommendation APIs

Current public Student generation uses **Recommendation V3**; CV parsing remains **V2**. Internal V1/V2 recommendation routes remain compatibility paths, not versioned public Student generation endpoints. All public recommendation endpoints require STUDENT and return `ApiResponse<T>`; ownership comes exclusively from JWT, never client `studentId`/`userId`.

Executable evidence: [controller](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/controller/RecommendationController.java), [request DTO](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/dto/request/GenerateRecommendationRequest.java), [generation](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/RecommendationGenerationServiceImpl.java), [transaction service](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/RecommendationTransactionService.java), [validator](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/AiRecommendationV3ResponseValidator.java), [response DTOs](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/dto/response/), [API tests](../backend/src/test/java/com/tttn/jobrecommendation/integration/CvAnalysisRecommendationApiIT.java), and [active V3 contract](recommendation-ranking-v3-contract.md).

### POST `/api/students/me/recommendations/generate`

Request:

```json
{
  "cvId": 12,
  "threshold": 0.1,
  "limit": 20
}
```

- `cvId`: required positive id of the authenticated Student's selected CV. Absent/foreign CV returns indistinguishable `404 RESOURCE_NOT_FOUND`. Selection does not require that CV to be active.
- `threshold`: defaults to 0.1 when omitted; required non-null value in [0,1].
- `limit`: defaults to 20 when omitted; required non-null integer in [1,100], one global result limit.
- Unknown fields or malformed JSON return `400 BAD_REQUEST`; Jakarta validation failures return `400 VALIDATION_ERROR`.
- Selected CV must have persisted READY status, nonblank `processedText` and `languageCode`, non-null confidence in [0,1], and processingVersion exactly `bilingual-nlp-v2-skills-v1`. Missing/incompatible analysis returns `409 CV_ANALYSIS_NOT_READY` before a run is created. Empty extracted skills are allowed.
- Supported stored language codes are en/vi/mixed/unknown (V15 CHECK and parsing contract). Low confidence, mixed, and unknown metadata are valid snapshots routed to FALLBACK; >=0.65 is a text-scoring condition, not a blanket generation readiness requirement.

V3 consumes only selected persisted processed text, canonicalized extracted skills, language code/confidence and processing version. It does not require `extractedText` for scoring, reload/reparse the file, preprocess CV text again, or redetect CV language. It never substitutes Student profile text, manual `student_skills`, active CV or another CV. See [snapshot readiness tests](../backend/src/test/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/RecommendationTransactionServiceV3Test.java).

Generation is synchronous. Backend commits a PROCESSING run with source CV, performs the AI call outside database transactions, then atomically persists results and SUCCESS. An AI/validation/persistence failure independently marks FAILED with finish time and sanitized error, without partial results. Requests create independent runs after successful preparation; there is no asynchronous polling job or generation deduplication contract.

Backend prepares only ACTIVE Jobs from VERIFIED Companies with deadline null/today/future, ordered by id, using batched Job/skill queries. Canonical skill lists are sorted/deduplicated; a Job with >100 canonical skills fails explicitly rather than truncating. Text contains TITLE, DESCRIPTION, REQUIREMENTS, SKILLS in that order separated by blank lines. It excludes benefits, salary, location, Company name, lifecycle timestamps and other unrelated fields. AI detects/preprocesses Job text; Backend owns corpus eligibility.

Internal V3 request (`POST /internal/v3/recommendations`, internal API key required):

```json
{
  "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
  "cv": {
    "id": 12,
    "processedText": "java spring_boot rest_api",
    "skills": ["java", "spring boot"],
    "languageCode": "en",
    "languageConfidence": 0.98,
    "processingVersion": "bilingual-nlp-v2-skills-v1"
  },
  "jobs": [
    {
      "id": 101,
      "text": "TITLE:\nBackend Intern\n\nDESCRIPTION:\nBuild APIs.\n\nREQUIREMENTS:\nJava experience.\n\nSKILLS:\njava, spring boot",
      "skills": ["java", "spring boot"]
    }
  ],
  "threshold": 0.1,
  "limit": 20
}
```

Internal V3 response example (illustrative cosine, consistent formula/evidence):

```json
{
  "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
  "algorithm": "tfidf-cosine-hybrid",
  "algorithmVersion": "bilingual-recommendation-v3",
  "results": [
    {
      "jobId": 101,
      "rankingTier": "PRIMARY",
      "rankingScore": 0.87,
      "overallScore": 0.87,
      "textScore": 0.8,
      "skillScore": 1.0,
      "scoringStrategy": "SAME_LANGUAGE_HYBRID",
      "matchedSkills": ["java", "spring boot"],
      "missingSkills": [],
      "reason": "Same-language text and declared skill overlap."
    }
  ]
}
```

AI returns no official `rankPosition` or `tierRankPosition`. It applies threshold to `rankingScore`, orders PRIMARY before FALLBACK (score DESC, jobId ASC within each tier), then takes the global limit. Backend validates and reorders the returned subset, assigns continuous global ranks 1..N and independent tier ranks 1..n. Backend does not independently recompute cosine or verify omitted corpus members' Top-K scores.

#### V3 score semantics

| Field / condition | PRIMARY | FALLBACK |
|---|---|---|
| `scoringStrategy` | SAME_LANGUAGE_HYBRID | CROSS_LANGUAGE_SKILL_BASED |
| Language routing | Both en/vi, same language, both confidence >=0.65 | All other pairs, including mixed/unknown/low-confidence |
| `textScore` | Non-null cosine [0,1] | Explicit null |
| `skillScore` | Matched canonical Job skills / all canonical Job skills; 0 with no Job skills | Same coverage formula; 0 with no Job skills |
| `overallScore` | 0.65 * textScore + 0.35 * skillScore with Job skills; textScore alone without Job skills | Explicit null |
| `rankingScore` | overallScore | skillScore |
| Public `score` | Deprecated alias of rankingScore | Deprecated alias of rankingScore, not overall fit |

Include iff rankingScore >= threshold; threshold=0 can retain zero-score results within the limit. PRIMARY and FALLBACK scores are not one calibrated overall-fit scale. FALLBACK 1.0 means coverage of declared canonical Job skills only.

Backend rejects the whole response on requestId/version mismatch, extra/unknown wire fields, non-corpus or duplicate Job ids, excess result count, invalid scores, below-threshold results, invalid tier/strategy/nullability, bad formulas or skill evidence. Expected metadata is exactly `tfidf-cosine-hybrid` / `bilingual-recommendation-v3`. Scores must be finite [0,1] with at most eight decimal places. Threshold and official ordering use raw BigDecimal values before HALF_UP rounding to five decimals for NUMERIC(8,5) persistence. Consequently rounded public scores can tie despite distinct raw scores, and a rounded hybrid formula can differ slightly from recomputation on rounded components.

Matched/missing lists must be canonical, sorted, unique, non-null, bounded (<=100 values, each <=150 characters), and equal to the CV/Job intersection and Job-minus-CV skills respectively. Backend recomputes skill coverage and the PRIMARY formula (eight-decimal formula allowance 0.00000001). V3 reason must be nonblank, <=2000 characters, and is stripped before storage. These checks are implemented, not deferred TODOs.

Successful `200` response uses message `Recommendations generated successfully`. Example **data** inside the ApiResponse envelope:

```json
{
  "id": 55,
  "cvId": 12,
  "sourceType": "CV",
  "algorithm": "tfidf-cosine-hybrid",
  "algorithmVersion": "bilingual-recommendation-v3",
  "totalJobsScanned": 1,
  "status": "SUCCESS",
  "totalRecommended": 1,
  "errorMessage": null,
  "startedAt": "2026-10-13T10:00:00",
  "finishedAt": "2026-10-13T10:00:01",
  "createdAt": "2026-10-13T10:00:00",
  "results": [
    {
      "id": 91,
      "jobId": 101,
      "jobTitle": "Backend Intern",
      "companyName": "Example Company",
      "rankPosition": 1,
      "tierRankPosition": 1,
      "rankingTier": "PRIMARY",
      "rankingScore": 0.87,
      "overallScore": 0.87,
      "score": 0.87,
      "textScore": 0.8,
      "skillScore": 1.0,
      "scoringStrategy": "SAME_LANGUAGE_HYBRID",
      "matchedKeywords": ["java", "spring boot"],
      "missingSkills": [],
      "reason": "Same-language text and declared skill overlap.",
      "createdAt": "2026-10-13T10:00:01"
    }
  ]
}
```

Public results contain exactly the fields shown above; `matchedKeywords` represents internal matchedSkills, with no duplicate public matchedSkills property. New V3 ranks/tier/rankingScore/skillScore/strategy/evidence/reason are populated; overallScore/textScore are null for FALLBACK. Old incomplete history may retain null algorithm metadata, components, tier, tierRankPosition and reason; it must not be relabeled as V3. Null stored evidence lists map to empty public lists. [Mapper](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/mapper/RecommendationMapper.java) and [serialization tests](../backend/src/test/java/com/tttn/jobrecommendation/modules/ranking/dto/response/RankingResponseSerializationTest.java) confirm alias/null behavior.

An empty eligible corpus skips AI and completes SUCCESS with V3 constants above, totalJobsScanned=0, totalRecommended=0, empty results, null error and non-null finish time. These V3 constants do not come from the legacy V2 recommendation configuration. AI transport errors use the common AI error codes; transactional/non-AI generation failure uses RECOMMENDATION_GENERATION_FAILED.

### GET `/api/students/me/recommendation-runs/{runId}`

Returns owned run detail (the generation data fields above) for PROCESSING, SUCCESS or FAILED, with results in persisted rankPosition order. Missing/foreign ids return indistinguishable `404 RECOMMENDATION_RUN_NOT_FOUND`. PROCESSING can have null finish/error/algorithm metadata; FAILED exposes sanitized error and no partial results from failed generation.

### GET `/api/students/me/recommendation-runs`

Returns `ApiResponse<List<RecommendationRunResponse>>`, not pagination. Fields: id, cvId, sourceType, algorithm, algorithmVersion, totalJobsScanned, totalRecommended, status, startedAt, finishedAt, createdAt. Results/errorMessage are detail-only. List order is createdAt DESC; the list query does not specify a secondary id tie-break.

### GET `/api/students/me/recommendation-results/latest`

Returns `ApiResponse<List<RecommendationResultResponse>>` for latest SUCCESS by createdAt DESC then id DESC, with persisted rankPosition order; returns [] if none. Newer FAILED/PROCESSING runs do not hide earlier SUCCESS. These GETs never trigger generation or reanalysis.

History preserves scores/evidence/ranks and run metadata, but not immutable full CV/Job/corpus input. Job title and Company name come from current relationships. Student runs do not persist requestId/threshold/limit or CV-version/corpus snapshots; exact historical scoring input cannot be reconstructed. V17 backfills recognized V2 rows' tier/overall/per-tier ranks without changing historical global ranks. Older incomplete rows remain readable with null typed metadata; no history read reranks them.

#### Internal V2 recommendation compatibility

`POST /internal/v2/recommendations` still exists, with internal authentication. V2 uses `{requestId, cv:{id,text,skills}, jobs:[{id,text,skills}], threshold,limit}` with raw/extracted CV `text`, not V3 processed snapshot metadata. Metadata is `tfidf-cosine-hybrid` / `bilingual-recommendation-v2`. Results contain jobId, score, textScore, skillScore, scoringStrategy, matchedSkills, missingSkills, reason; no official rank or V3 tier fields. Same-language declared-skill score is 0.65 text + 0.35 skill; without skills it is text; cross-language/low-confidence score is skill with textScore=null. V2 uses score DESC then jobId ASC with one global limit, unlike V3 tier ordering.

V2 DTOs/client/validator and tests remain isolated compatibility code; current public Student generate calls `recommendV3`, not this V2 path. CV reanalysis still calls `/internal/v2/cv/parse`. See [V2 AI routes](../ai-service/v2/api.py), [V2 compatibility validator](../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/AiRecommendationResponseValidator.java), and [client routes](../backend/src/main/java/com/tttn/jobrecommendation/infrastructure/ai/client/RestAiServiceClient.java).

#### Legacy internal V1 recommendation contract

`POST /internal/v1/recommendations` remains unchanged for older backend deployments during rollout:

```json
{
  "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
  "cv": {
    "id": 12,
    "processedText": "java spring boot",
    "skills": ["java", "spring boot"]
  },
  "jobs": [
    {
      "id": 101,
      "processedText": "backend intern build apis java postgresql",
      "skills": ["java", "postgresql"]
    }
  ],
  "threshold": 0.1,
  "limit": 20
}
```

```json
{
  "requestId": "f8dd2777-3457-4515-8829-a63599e74775",
  "algorithmVersion": "tfidf-cosine-v1",
  "results": [
    {
      "jobId": 101,
      "score": 0.87342,
      "rank": 1,
      "matchedSkills": ["Java"],
      "missingSkills": ["PostgreSQL"],
      "reason": "Matched CV and job text"
    }
  ]
}
```

V1 stays a distinct compatibility contract, including its legacy rank field; it is not relabeled as V2/V3 and is not used by current public generation.

### Deployment dependencies and known limitations

Current Backend requires AI V2 parsing and V3 recommendation/ranking routes together, with released Flyway V1–V18. Keep internal V1/V2 compatibility for older consumers; verify matching route contracts before rollout. Backend supplies no NLP/extraction itself; English/Vietnamese processing and canonical extraction are implemented in AI. OCR, embeddings, manual extracted-data editing and queues are not implemented. Job-skill importance/minLevel are not scoring components; concurrent CV reanalysis isolation remains a separate evidence gap. Documentation synchronization adds no implementation or new runtime verification.

## Notifications

Notifications are persistent in-app records for authenticated users. They are not realtime events; WebSocket, SSE, push notification, Firebase, and email delivery are not implemented.

Initial supported automatic event:

- `APPLICATION_STATUS_CHANGED`: created for the student when a company or admin successfully changes one of the student's application statuses and the student's application-status preference is enabled.

Future enum support:

- `JOB_STATUS_CHANGED`, `RECOMMENDATION`, and `SYSTEM` have persisted preference fields for future automatic producers. No new automatic producer is implemented in this package.

### GET `/api/users/me/notification-settings`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Returns only the authenticated user's settings:

```json
{
  "applicationStatusEnabled": true,
  "jobStatusEnabled": true,
  "recommendationEnabled": true,
  "systemEnabled": true,
  "revision": 0,
  "updatedAt": null
}
```

When the user has no persisted row, every setting defaults to `true`, `revision`
is 0 and `updatedAt` is `null`. GET is read-only and does not create a row. GET
and successful PUT return a strong numeric ETag matching `data.revision`.

### PUT `/api/users/me/notification-settings`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Full replacement request:

```json
{
  "applicationStatusEnabled": true,
  "jobStatusEnabled": true,
  "recommendationEnabled": true,
  "systemEnabled": true
}
```

Every boolean is required. Unknown fields, including `userId`, are rejected. The authenticated user is always derived from the JWT.

V21 requires `If-Match` captured with the draft. The same 428/400/409 contract as
Company account applies. `revision` is response metadata, not a PUT body field.
An absent row accepts only revision 0 and inserts revision 1 using the existing
unique key and `ON CONFLICT DO NOTHING`; existing rows use conditional SQL
`WHERE user_id = JWT user AND revision = captured`, advancing once. Two writers
at revision N have exactly one winner and one 409, including concurrent first
inserts. Response data has the same fields as GET with non-null `updatedAt`.
Reading current values after a conflict does not authorize attaching their
revision to the old draft. Clients require explicit draft replacement/review.

Disabling a preference suppresses only future automatic notifications of that type. It does not delete, hide, or mark existing notifications. A missing settings row always means enabled. Currently only `APPLICATION_STATUS_CHANGED` has an automatic producer.

### GET `/api/notifications?page=1&size=20`

Roles: any authenticated active user.

Returns only the JWT user's notifications, ordered by `createdAt DESC, id DESC`.
Optional `unread=true` selects unread records, `unread=false` selects read records;
omitting it selects both. Optional `type` is one of `APPLICATION_STATUS_CHANGED`,
`JOB_STATUS_CHANGED`, `SYSTEM`, `RECOMMENDATION`. Both filters combine with AND.
Filtering and count execute in PostgreSQL before LIMIT/OFFSET; the existing
`PageResponse` envelope has filtered `totalItems`/`totalPages`, 1-based page and
size 1–100 (defaults 1/20). Invalid non-empty boolean/enum values return 400
`BAD_REQUEST`; invalid page/size returns 400 `VALIDATION_ERROR`.
Omitted filters retain existing behavior. Out-of-range pages contain no items,
with the filtered total unchanged. Offset pagination is not a snapshot across
concurrent writes. `/unread-count` always counts all unread records for the JWT
user, independently of filters or the current page.

Response item:

```json
{
  "id": 1,
  "type": "APPLICATION_STATUS_CHANGED",
  "title": "Application status updated",
  "message": "Your application for Backend Developer Intern has been updated to REVIEWED.",
  "referenceType": "APPLICATION",
  "referenceId": 10,
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-07-15T10:00:00"
}
```

### GET `/api/notifications/unread-count`

Roles: any authenticated active user.

Response:

```json
{
  "unreadCount": 5
}
```

### PATCH `/api/notifications/{id}/read`

Roles: any authenticated active user.

Marks one owned notification as read. This operation is idempotent. A notification belonging to another user is returned as not found.

### PATCH `/api/notifications/read-all`

Roles: any authenticated active user.

Marks all unread notifications for the authenticated user as read.

## Swagger

Swagger UI: `/swagger-ui.html`

OpenAPI JSON: `/v3/api-docs`

Swagger is configured with Bearer JWT security scheme `bearerAuth`.


## Interview scheduling and job invitations (W3-C1A / V24)

Authenticated COMPANY routes: `POST/GET /api/companies/me/interviews`, `PATCH /api/companies/me/interviews/{id}/status`, `POST/GET /api/companies/me/invitations`, `PATCH /api/companies/me/invitations/{id}/status` (owner cancellation).

Authenticated STUDENT routes: `GET /api/students/me/interviews`, `PATCH /api/students/me/interviews/{id}/respond`, `GET /api/students/me/invitations`, `PATCH /api/students/me/invitations/{id}/respond`.

All use ApiResponse. Lists return PageResponse, accept 1-based page (default1), size1–100 (default10), and sort by createdAt DESC/id DESC within JWT ownership. PATCH bodies require `expectedStatus` and `status`: stale state returns409 RECRUITMENT_STATE_CONFLICT, invalid transitions400, foreign access403, missing records404. No existing Application status is changed by these endpoints; acceptance does not apply automatically. Duplicate PENDING invitations return409 INVITATION_ALREADY_PENDING. No public/Admin listing is added.

See [the executable DTO contract, transitions, eligibility and concurrency decisions](datn/interviews-invitations-backend.md) for exact creation fields, validation limits, supported actions and limitations. This is Backend support only; no integrated UI is claimed.

## Application-scoped private messaging (V25)

Only authenticated STUDENT/COMPANY participants of the persisted Application may use these endpoints; ADMIN has no inbox or override. All return `ApiResponse`, HTTP 200 on success (including conversation reuse). JWT-derived identities are checked against Application.student and Application.job.company; no public messaging directory exists.

| Method / path | Input | `data` result |
|---|---|---|
| GET `/api/conversations` | `page=1`, `size=10` (page >=1, size 1-100) | `PageResponse<ConversationResponse>` |
| POST `/api/conversations` | `{ "applicationId": 123 }`, required positive integer identifying an existing Application | `ConversationResponse`, created or reused |
| GET `/api/conversations/{id}/messages` | Positive conversation ID; same bounded pagination | `PageResponse<MessageResponse>` |
| POST `/api/conversations/{id}/messages` | `{ "content": "Hello" }` | `MessageResponse` |
| PATCH `/api/conversations/{id}/read` | Positive conversation ID, no request body | `{ "conversationId": 123, "markedCount": 2 }` |

`ConversationResponse` contains exactly `id`, `applicationId`, `companyId`, `studentId`, `jobId`, nullable `lastMessageAt`, `createdAt`, `updatedAt`. Listings contain no message body, CV, contact details, passwords or storage metadata. Ownership filtering and total counts run in PostgreSQL; inconsistent participant tuples are excluded. Order is `COALESCE(last_message_at, created_at) DESC, id DESC`.

`MessageResponse` contains exactly `id`, `conversationId`, `senderUserId`, `senderRole` (STUDENT/COMPANY), `content`, `isRead`, `createdAt`. Only participants receive content. Messages are ordered `created_at ASC, id ASC`, paginated in PostgreSQL. GET does not mark messages read. Timestamps follow existing local ISO-8601 / SQL TIMESTAMP conventions.

Both request DTOs reject unknown fields (including `senderUserId`, `senderRole`, `companyId`, `studentId`). Content is required, nonblank, at most **5000 Java UTF-16 code units**, preserved without trimming; NUL characters (unsupported by PostgreSQL text) are rejected with 400. Sender identity/role and timestamps are assigned by Backend. No attachments, message updates/deletes, notifications or realtime transport are provided.

PATCH read marks all currently persisted unread messages from the opposite participant in this conversation, including messages outside the current page. It never marks the caller's outbound messages; subsequent calls return `markedCount: 0` until new incoming messages arrive. No recipient identity is accepted from clients.

Conversation creation locks the Application row and has a unique Application constraint. Sends and read operations lock the Conversation row, serializing across Backend instances. Send inserts a message and updates lastMessageAt in one transaction; the timestamp is chosen after locking and cannot regress below the previous lastMessageAt. Read and send are linearized: a message committed after a read operation remains unread.

All existing Application statuses (including REJECTED/WITHDRAWN history) allow participant create/read/send. Company verification changes or Job closure do not remove private history access for otherwise authenticated active accounts. These APIs never create an Application or modify Company/Job/Application/CV/Interview/Invitation status. Reapplication keeps a separate conversation for each Application row.

Errors use the established envelope: missing/invalid JWT 401, wrong role or foreign participant 403, missing Application/Conversation 404, invalid JSON/unknown fields/invalid IDs/content/pagination 400. Validation errors do not echo content. No If-Match is required: these append-only operations use transactional row locks. Offset pages can shift when new activity arrives; clients should refetch current pages.

See [implementation and focused verification](datn/application-messaging-backend.md). This Backend contract does not claim Frontend messaging integration or browser E2E support.
