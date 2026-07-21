# BE Core Regression Cases

Use the dev profile and the local database defaults unless overridden:

- Database: `student_job_recommendation`
- Username: `postgres`
- Password: `123456`

Common assertions:

- All responses use `ApiResponse<T>`.
- Protected requests use `Authorization: Bearer <token>`.
- `passwordHash` is never present in response JSON.

## Auth

1. Register Student: `POST /api/auth/register` with role `STUDENT`; expect `201`.
2. Login Student: `POST /api/auth/login`; save token.
3. Auth Me Student: `GET /api/auth/me`; expect role `STUDENT`.
4. Register Company: `POST /api/auth/register` with role `COMPANY`; expect `201`.
5. Login Company: `POST /api/auth/login`; save token.
6. Auth Me Company: `GET /api/auth/me`; expect role `COMPANY`.
7. Login Admin: `POST /api/auth/login` with `admin@example.com / 123456`; save token.
8. Auth Me Admin: `GET /api/auth/me`; expect role `ADMIN`.

## Student

9. Get Student Me: student token, `GET /api/students/me`; expect `200`.
10. Update Student Me: student token, `PUT /api/students/me`; expect changed fields.
11. Get Student Profile: student token, `GET /api/students/me/profile`; expect `200`.
12. Update Student Profile: student token, `PUT /api/students/me/profile`; expect confirmed profile fields.
13. Company cannot access Student API: company token, `GET /api/students/me`; expect `403`.

## Company

14. Get Company Me: company token, `GET /api/companies/me`; expect `200`.
15. Update Company Me: company token, `PUT /api/companies/me`; expect changed fields.
16. Student cannot access Company API: student token, `GET /api/companies/me`; expect `403`.

## Skills

17. List Skills: any authenticated token, `GET /api/skills`; expect paged skills.
18. Admin Create Skill: admin token, `POST /api/skills`; expect `201`.
19. Admin Update Skill: admin token, `PUT /api/skills/{id}`; expect changed skill.
20. Student cannot create Skill: student token, `POST /api/skills`; expect `403`.

## Jobs

21. Company Create Job: company token, `POST /api/jobs`; expect company-owned job.
22. Job with Skills: company token, `POST /api/jobs` with `skills`; expect skill list in response.
23. Student List Active Jobs: student token, `GET /api/jobs`; expect active jobs only.
24. Student Get Job Detail: student token, `GET /api/jobs/{id}` for active job; expect `200`.
25. Company Update Own Job: company token, `PUT /api/jobs/{id}`; expect `200`.
26. Student cannot create Job: student token, `POST /api/jobs`; expect `403`.
27. Invalid salary range rejected: `salaryMin > salaryMax`; expect `400`.
28. Duplicate Job Skill IDs rejected: repeated `skillId`; expect `400`.
29. JobType REMOTE rejected: request `jobType: "REMOTE"`; expect `400`.
30. WorkingModel REMOTE accepted: request `workingModel: "REMOTE"` and valid `jobType`; expect success.

## Applications

31. Student Apply: student token, `POST /api/jobs/{jobId}/apply`; expect `200`.
32. Duplicate Apply rejected: repeat same request; expect `400`.
33. Student List Own Applications: student token, `GET /api/students/me/applications`; expect own rows.
34. Company List Applications for Own Job: company token, `GET /api/companies/me/jobs/{jobId}/applications`; expect rows.
35. Company Update Application Status: company token, `PATCH /api/applications/{id}/status`; expect valid transition.

## CV

36. Upload CV: student token, multipart `POST /api/students/me/cv`; expect metadata.
37. List CVs: student token, `GET /api/students/me/cv`; expect uploaded CV.
38. Get Active CV: student token, `GET /api/students/me/cv/active`; expect active CV or `null`.
39. Company cannot upload Student CV: company token, `POST /api/students/me/cv`; expect `403`.

## Recommendation Skeleton

40. Student recommendation history: student token, `GET /api/students/me/recommendation-runs`; expect list.
41. Student latest recommendation results: student token, `GET /api/students/me/recommendation-results/latest`; expect list.
42. Company cannot access Student recommendation data: company token; expect `403`.

## Saved Jobs

43. Save Job: student token, `POST /api/students/me/saved-jobs/{jobId}`; expect saved job response.
44. Duplicate Save rejected: repeat same request; expect `400`.
45. List Saved Jobs: student token, `GET /api/students/me/saved-jobs?page=1&size=10`; expect saved job.
46. Remove Saved Job: student token, `DELETE /api/students/me/saved-jobs/{jobId}`; expect success.
47. Saved Job disappears from list: repeat list; expect no removed row.
48. Company cannot use Saved Jobs API: company token; expect `403`.

## Student Skills

49. Get Student Skills: student token, `GET /api/students/me/skills`; expect list.
50. Update Student Skills: student token, `PUT /api/students/me/skills`; expect replaced list.
51. Duplicate skill IDs rejected: repeated `skillId`; expect `400`.
52. Invalid skillId rejected: unknown `skillId`; expect `404`.
53. Company cannot manage Student Skills: company token; expect `403`.

## JWT Hardening

54. Notification flow setup: login Student and Company.
55. Student applies to Company's active job.
56. Company changes Application status to `REVIEWED`.
57. Student calls `GET /api/notifications`; expect `APPLICATION_STATUS_CHANGED`.
58. Student calls `GET /api/notifications/unread-count`; expect `unreadCount > 0`.
59. Student calls `PATCH /api/notifications/{id}/read`; expect `isRead = true`.
60. Student calls unread count again; expect count decreased.
61. Create another unread notification through another valid application status change.
62. Student calls `PATCH /api/notifications/read-all`; expect success.
63. Student calls unread count again; expect `unreadCount = 0`.
64. Another user cannot access or mark the student's notification by id; expect `404`.
65. Unauthenticated `GET /api/notifications` is rejected; expect `401`.

## JWT Hardening

66. Login Student and save JWT.
67. In DB, set the student user's `status` to `BLOCKED`.
68. Use old JWT on `GET /api/auth/me`; expect unauthorized or forbidden access.
69. Use old JWT on `GET /api/notifications`; expect unauthorized or forbidden access.
70. Restore status to `ACTIVE`.

## Seeder

71. Restart backend with `dev` profile; expect no duplicate users/skills/jobs/job skills.
72. Set `student@example.com` status to `BLOCKED`; restart; status remains `BLOCKED`.
73. Change a demo user's password hash; restart; password hash is not reset to the default demo password.

## Phase 1 FE API Gaps

74. Public company list: unauthenticated `GET /api/public/companies`; expect `PageResponse` and only `VERIFIED` companies.
75. Public company privacy: response items do not contain `taxCode`, `phone`, or user data; `companySize` and `logoUrl` are `null`.
76. Public company status exclusion: set one company `PENDING` and one `BLOCKED`; list excludes both.
77. Public company open jobs: create active and non-active jobs; `openJobs` counts only `ACTIVE`.
78. Public company detail: unauthenticated `GET /api/public/companies/{id}` for `VERIFIED`; jobs array contains only `ACTIVE` jobs ordered by `publishedAt` descending.
79. Public non-public detail: `GET /api/public/companies/{id}` for `PENDING` or `BLOCKED`; expect `404`.
80. Admin users list: admin token, `GET /api/admin/users?role=STUDENT&status=ACTIVE&page=1&size=10`; expect paged users.
81. Admin users filter: admin token, use `fullName` or `keyword`; expect matching users only.
82. Admin user detail: admin token, `GET /api/admin/users/{id}`; expect base user plus role profile summary when data exists.
83. Admin user privacy: `passwordHash` is absent from list, detail, status update, auth, and profile responses.
84. Admin updates another user status: `PATCH /api/admin/users/{id}/status`; expect updated `status`.
85. Admin self-protection: admin token, `PATCH /api/admin/users/{ownId}/status` with `INACTIVE` or `BLOCKED`; expect `400`.
86. Student cannot access admin users: student token, `GET /api/admin/users`; expect `403`.
87. Blocked old JWT: login a user, admin sets status to `BLOCKED`, then reuse old JWT on a protected API; expect unauthorized or forbidden.
88. Admin companies list: admin token, `GET /api/admin/companies?status=VERIFIED&page=1&size=10`; expect paged companies.
89. Admin companies filter: admin token, filter by `keyword`, `companyName`, `taxCode`, and `industry`; expect matching companies.
90. Admin company detail: admin token, `GET /api/admin/companies/{id}`; expect full supported company fields and active `openJobs` count.
91. Admin updates company status: admin token, `PATCH /api/admin/companies/{id}/status`; expect updated company `status` and unchanged user `status`.
92. Company cannot access admin companies: company token, `GET /api/admin/companies`; expect `403`.
93. Company aggregate applications: company token, `GET /api/companies/me/applications`; expect applications only for jobs owned by that company.
94. Company application filters: test `status`, `jobId`, and `keyword`; expect scoped matches only.
95. Company application detail: company token, `GET /api/companies/me/applications/{id}` for own job; expect safe application/CV metadata only.
96. Company cross-company protection: company token, request another company's application detail; expect no data and `403`.
97. Student application detail: student token, `GET /api/students/me/applications/{id}` for own application; expect safe detail.
98. Student cross-application protection: student token, request another student's application detail; expect no data.
99. Student CV detail: student token, `GET /api/students/me/cv/{id}` for own CV; expect safe metadata.
100. CV privacy: CV responses do not contain `filePath` or `storedFileName`.
101. Student cross-CV protection: student token, request another student's CV detail; expect `404`.
102. Student active CV: student token, `PATCH /api/students/me/cv/{id}/active`; selected CV becomes `isActive=true`.
103. Active CV uniqueness: previous active CV becomes inactive and only one active CV remains for the student.
104. Active CV idempotency: repeat `PATCH /api/students/me/cv/{id}/active`; expect success and one active CV.
105. Company cannot access student CV APIs: company token, `GET /api/students/me/cv/{id}`; expect `403`.
