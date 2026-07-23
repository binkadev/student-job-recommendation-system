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

Common protected-endpoint errors:

- `UNAUTHORIZED`: missing, invalid, expired, `BLOCKED`, or `INACTIVE` user token.
- `ACCESS_DENIED`: authenticated user does not have the required role, or an endpoint reports failed ownership as forbidden.
- `RESOURCE_NOT_FOUND`: requested resource does not exist or is intentionally hidden from that endpoint.
- `VALIDATION_ERROR`: invalid request body or query parameter.
- `BAD_REQUEST`: invalid enum transition, duplicate business action, or unsupported sort.
- `CV_IN_USE`: the requested CV is referenced by an application or another protected record and cannot be deleted (`409 Conflict`).
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
- `RecommendationRunStatus`: `SUCCESS`, `FAILED`
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

Rules: job must be active, deadline must not be passed, and a student cannot apply to the same job twice.

### GET `/api/students/me/applications`

Role: `STUDENT`.

Returns the current student's applications.

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

## Recommendation Read-Only APIs

### GET `/api/students/me/recommendation-runs`

Role: `STUDENT`.

Returns current student's recommendation run history.

### GET `/api/students/me/recommendation-results/latest`

Role: `STUDENT`.

Returns latest recommendation results for the current student. This is database read-only; no recommendation algorithm is implemented here.

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
