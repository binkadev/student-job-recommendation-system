# API Contract

Backend base URL: `http://localhost:8080`

All responses use `ApiResponse<T>`.

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

Authentication uses `Authorization: Bearer <jwt>` for all protected endpoints.

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

## Company

### GET `/api/companies/me`

Role: `COMPANY`.

Returns current company profile.

### PUT `/api/companies/me`

Role: `COMPANY`.

Request fields: `companyName`, `taxCode`, `description`, `website`, `address`, `phone`, `industry`.

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

### GET `/api/companies/me/jobs/{jobId}/applications`

Role: `COMPANY`.

Returns applications for a job owned by the current company.

### PATCH `/api/applications/{id}/status`

Roles: `STUDENT`, `COMPANY`, `ADMIN`.

Request field: `status`.

Company/Admin transitions: `PENDING -> REVIEWED`, `PENDING|REVIEWED -> ACCEPTED|REJECTED`.

Student transition: `PENDING -> WITHDRAWN`.

## CV

### POST `/api/students/me/cv?active=true`

Role: `STUDENT`.

Multipart request part: `file`. Supported extensions/content types are PDF and DOCX. The current implementation stores metadata and file path only; it does not extract text.

### GET `/api/students/me/cv`

Role: `STUDENT`.

Lists the current student's CV files.

### GET `/api/students/me/cv/active`

Role: `STUDENT`.

Returns the active CV or `null`.

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

- `APPLICATION_STATUS_CHANGED`: created for the student when a company or admin successfully changes one of the student's application statuses.

Future enum support:

- `RECOMMENDATION` exists for future recommendation integration, but automatic matching-job notification generation is not implemented.

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
