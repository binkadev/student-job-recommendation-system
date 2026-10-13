# API Contract

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
- `AI_SERVICE_UNAVAILABLE`: the AI service connection failed or the service returned a server error (`503 Service Unavailable`).
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

### GET `/api/students/me`

Role: `STUDENT`.

Returns current student account/profile summary.

### PUT `/api/students/me`

Role: `STUDENT`.

Request fields: `fullName`, `major`, `university`, `phone`, `graduationYear`, `location`, `headline`.

### GET `/api/students/me/profile`

Role: `STUDENT`.

Returns confirmed structured student profile fields, including `preferredJobType`, `rawText`, `processedText`, and `profileCompleteness`.

### PUT `/api/students/me/profile`

Role: `STUDENT`.

Request fields: `summary`, `education`, `experience`, `projects`, `targetPosition`, `preferredLocation`, `preferredJobType`.

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

### GET `/api/companies/me`

Role: `COMPANY`.

Returns current company profile.

### PUT `/api/companies/me`

Role: `COMPANY`.

Request fields: `companyName`, `taxCode`, `description`, `website`, `address`, `phone`, `industry`.

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

- `keyword`: optional case-insensitive partial match against student full name, student email, university, major, headline, or the saved application's job title; maximum length 255.
- `page`: 1-based page number, default `1`.
- `size`: page size from 1 through 100, default `10`.
- `sort`: accepts `field,asc`, `field,desc`, `field:asc`, or `field:desc`; maximum length 100.

Allowed sort fields: `id`, `createdAt`, `updatedAt`. Default sort: `createdAt,desc`. Unsupported fields or directions return `400 BAD_REQUEST`.

Each response item contains:

```json
{
  "id": 42,
  "applicationId": 123,
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

- `STUDENT` sees active jobs.
- `COMPANY` sees active jobs plus its own jobs.
- `ADMIN` sees active jobs by default unless `status` is provided.

### GET `/api/jobs/{id}`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Students can view active jobs. Companies can view active jobs and their own jobs. Admin can view all jobs.

### POST `/api/jobs`

Roles: `COMPANY`, `ADMIN`.

Company-created jobs always belong to the current company. Admin must provide `companyId`.

Request fields: `companyId`, `title`, `description`, `requirements`, `benefits`, `location`, `jobType`, `workingModel`, `status`, `salaryMin`, `salaryMax`, `currency`, `deadline`, `skills`.

Job skill item fields: `skillId`, `importance`, `minLevel`.

Validation: `salaryMin <= salaryMax`, duplicate job skill IDs are rejected, and `jobType=REMOTE` is invalid.

### PUT `/api/jobs/{id}`

Roles: `COMPANY`, `ADMIN`.

Company users can update only their own jobs. Admin can update all jobs.

### PATCH `/api/jobs/{id}/status`

Roles: `COMPANY`, `ADMIN`.

Request:

```json
{
  "status": "ACTIVE"
}
```

### DELETE `/api/jobs/{id}`

Roles: `COMPANY`, `ADMIN`.

Soft-closes the job by setting status to `CLOSED`.

## Applications

### POST `/api/jobs/{jobId}/apply`

Role: `STUDENT`.

Request fields: `cvFileId`, `coverLetter`.

Rules: Job must be ACTIVE, deadline null/today/future; supplied CV must belong to the authenticated Student. CV is optional and apply does not require READY analysis.

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
  "updatedAt": null
}
```

When the user has no persisted row, every setting defaults to `true` and `updatedAt` is `null`. GET is read-only and does not create a row.

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

The first PUT atomically creates the user's row; later PUT requests update that same row. Concurrent first writes use the database unique key and atomic upsert, so duplicate rows are not created. Response data has the same fields as GET with a non-null `updatedAt`.

Disabling a preference suppresses only future automatic notifications of that type. It does not delete, hide, or mark existing notifications. A missing settings row always means enabled. Currently only `APPLICATION_STATUS_CHANGED` has an automatic producer.

### GET `/api/notifications?page=1&size=20`

Roles: any authenticated active user.

Returns newest notifications first. Users only see their own notifications.

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
