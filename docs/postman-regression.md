# BE Core Regression Cases

Use the dev profile and the local database defaults unless overridden:

- Database: `student_job_recommendation`
- Username: `postgres`
- Password: `123456`

Common assertions:

- JSON responses use `ApiResponse<T>`. Successful CV file responses stream raw bytes; their error responses still use `ApiResponse<T>`.
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

## Core API Gap Package: CV Files and Admin Applications

Use two student accounts, two company accounts with one job each, an admin account, CV fixtures stored under the configured `APP_CV_UPLOAD_DIR`, and applications both with and without a CV. Keep any deliberately unsafe or undeletable fixture confined to disposable test data.

106. Student CV inline file: owning student token, `GET /api/students/me/cv/{cvId}/file`; expect `200`, exact bytes, stored `Content-Type`, `Content-Disposition: inline` with a sanitized original filename, and no internal path in response headers.
107. Student CV attachment: owning student token, `GET /api/students/me/cv/{cvId}/file?download=true`; expect the same bytes and content type with `Content-Disposition: attachment`.
108. Student cross-CV protection: another student token requests the file; expect `404 RESOURCE_NOT_FOUND`, indistinguishable from an unknown `cvId`.
109. CV path containment: set disposable CV metadata to a filename that would resolve outside the configured storage directory and request it; expect `404 RESOURCE_NOT_FOUND`, no outside-file bytes, and no server path in the error.
110. Missing physical CV: retain disposable CV metadata after removing its physical file, then request it; expect `404 RESOURCE_NOT_FOUND` without a path leak.
111. Delete unused CV: owning student deletes an unused CV with `DELETE /api/students/me/cv/{cvId}`; expect `200`, message `CV deleted successfully`, `data: null`, and metadata removed.
112. Delete removes physical file: after case 111, verify the file no longer exists under `APP_CV_UPLOAD_DIR` and a file request returns `404`.
113. Student cannot delete another student's CV: non-owner token sends the DELETE; expect `404 RESOURCE_NOT_FOUND`, and metadata and file remain.
114. Referenced CV cannot be deleted: apply using the CV, then send the DELETE; expect `409 CV_IN_USE`; verify the application, CV metadata, and physical file remain unchanged.
115. Active unused CV can be deleted: delete an active CV with no application reference; expect success, and verify no other CV is activated automatically.
116. Physical deletion failure is not success: use a disposable fixture whose physical deletion is forced to fail; expect `500 INTERNAL_SERVER_ERROR`, never a success envelope, and verify database metadata is not lost.
117. Company application CV inline file: owning company token requests `GET /api/companies/me/applications/{applicationId}/cv/file`; expect `200`, exact bytes, stored content type, sanitized inline filename, and no internal path headers.
118. Company application CV attachment: repeat with `?download=true`; expect `Content-Disposition: attachment`.
119. Company cross-application protection: another company token requests the application CV; expect `403 ACCESS_DENIED` and no file bytes or metadata.
120. Application without CV: owning company requests the CV file for an application with `cvFileId: null`; expect `404 RESOURCE_NOT_FOUND`.
121. Admin application list and exact filters: admin token calls `GET /api/admin/applications` and separately tests `status`, `studentId`, `jobId`, and `companyId`; expect only matching rows in `PageResponse<ApplicationResponse>`.
122. Admin application keyword: test partial, mixed-case matches for student full name, student email, job title, and company name; expect matching rows for every supported field.
123. Admin application pagination is 1-based: request `page=1&size=1` and `page=2&size=1`; expect `data.page` to echo 1 and 2, stable distinct items, and correct totals.
124. Admin application default sort: omit `sort`; expect applications ordered by `appliedAt,desc`.
125. Admin application allowed sorts: exercise `id`, `status`, `appliedAt`, `reviewedAt`, `createdAt`, and `updatedAt` with accepted comma or colon direction syntax.
126. Admin application invalid sort: request an unlisted field and an invalid direction; expect `400 BAD_REQUEST` in both cases.
127. Non-admin application list denied: student and company tokens call `GET /api/admin/applications`; expect `403 ACCESS_DENIED`.
128. Admin application detail: admin token calls `GET /api/admin/applications/{applicationId}`; expect the matching `ApplicationResponse`.
129. Absent admin application detail: use an unknown id; expect `404 RESOURCE_NOT_FOUND`.
130. Admin application privacy: list and detail responses contain only safe CV metadata (`cvFileId`, `cvFileName`) and never `filePath`, `fileUrl`, `storedFileName`, or an absolute storage path.

## Recruiter Saved Candidates and Notification Settings

Use two company accounts, at least two student accounts with profiles, jobs owned by each company, applications with and without CVs, and one admin account.

131. Save owned candidate: company token sends `POST /api/companies/me/saved-candidates` with its application id and an optional note; expect the created safe response.
132. Student identity is derived: add `studentId` or another unknown field to the save request; expect `400 BAD_REQUEST` and no row.
133. Cross-company application: company A attempts to save an application for company B's job; expect `403 ACCESS_DENIED`.
134. Duplicate saved candidate: save the same student twice for one company; expect `409 SAVED_CANDIDATE_ALREADY_EXISTS`, including when different company-owned applications identify that student.
135. Withdrawn application: save an owned withdrawn application; expect success because bookmarks do not alter application state.
136. Company-scoped list: call `GET /api/companies/me/saved-candidates`; expect only the authenticated company's rows.
137. Saved-candidate keyword: separately search partial mixed-case student name, email, university, major, headline, and job title; expect the matching candidate.
138. Saved-candidate paging: request `page=1&size=1` and `page=2&size=1`; expect 1-based page values, distinct stable items, and correct totals.
139. Saved-candidate sorts: exercise `id`, `createdAt`, and `updatedAt` with comma or colon direction syntax; omit sort to confirm `createdAt,desc`.
140. Invalid saved-candidate sort: use an unlisted field or invalid direction; expect `400 BAD_REQUEST`.
141. Saved-candidate privacy: list and create responses never contain `filePath`, `fileUrl`, `storedFileName`, password hashes, or absolute storage paths.
142. Delete owned saved candidate: send `DELETE /api/companies/me/saved-candidates/{id}`; expect success and the bookmark removed.
143. Delete preserves domain records: after case 142, verify the application, student, CV, job, and application status are unchanged.
144. Delete foreign saved candidate: company A deletes company B's saved-candidate id; expect `404 SAVED_CANDIDATE_NOT_FOUND`, identical to an absent id, and the row remains.
145. Notification defaults: each supported role calls `GET /api/users/me/notification-settings` without a row; expect all booleans `true`, `updatedAt: null`, and no inserted row.
146. Notification PUT create: send all four required booleans to `PUT /api/users/me/notification-settings`; expect the returned values and non-null `updatedAt`.
147. Notification PUT replace: send a second full body; expect the same database row id with every value replaced.
148. Notification validation: omit each boolean in turn; expect `400 VALIDATION_ERROR`.
149. Notification identity protection: add `userId` to PUT or attempt an id-based path; expect rejection or no matching route, and another user's row remains unchanged.
150. Notification role access: `STUDENT`, `COMPANY`, and `ADMIN` tokens can GET and PUT only their own settings; unauthenticated access returns `401`.
151. Notification unique constraint: attempt a second direct row for the same user in disposable DB data; expect the unique constraint to reject it.
152. Application notification disabled: set `applicationStatusEnabled=false`, then perform a valid company/admin application status transition; expect no new `APPLICATION_STATUS_CHANGED` notification.
153. Missing settings allows notification: remove the student's settings row, perform a valid employer status transition, and expect one notification.
154. Disable preserves existing notifications: create an existing notification, disable its type, and verify the existing row, read state, and count are unchanged.
155. Non-current preference fields: changing `jobStatusEnabled`, `recommendationEnabled`, or `systemEnabled` persists and returns correctly but creates no new producers, delivery channels, or recommendation algorithm behavior.

## Public Jobs, Saved Searches, and Password Change

Use verified and non-verified companies, jobs in multiple statuses with past/null/future deadlines, two students, one company user, and one admin user.

156. Anonymous public jobs: call `GET /api/public/jobs` without a token; expect `200`, 1-based `PageResponse`, and default `publishedAt,desc` then `createdAt,desc` ordering.
157. Public visibility: verify only `ACTIVE` jobs for `VERIFIED` companies with null or non-expired deadlines appear; draft, closed, other non-active, unverified-company, and past-deadline jobs do not.
158. Public hidden detail: request a hidden job and an absent id through `GET /api/public/jobs/{jobId}`; expect identical `404 RESOURCE_NOT_FOUND` envelopes.
159. Public filters: separately test case-insensitive `keyword`, `location`, and valid `jobType` and `workingModel`; expect matching visible jobs only.
160. Public paging bounds: test `page=2&size=1`; expect page `2`. Test `size=101`; expect `400 VALIDATION_ERROR`.
161. No public status filter: add `status=ACTIVE`; expect `400 BAD_REQUEST`.
162. Public response privacy: verify no status-management fields, company internals, normalized skill text, password data, or persistence audit fields are returned.
163. Public skill batching: compare pages of one and multiple skilled jobs; prepared-statement count remains constant rather than adding one skill query per job.
164. Create saved search: student token sends `POST /api/students/me/saved-searches`; expect trimmed safe fields and ownership assigned to that student.
165. Saved-search identity injection: add `studentId` or `userId`; expect `400 BAD_REQUEST` and no inserted row.
166. Saved-search list: student token calls `GET /api/students/me/saved-searches`; expect only owned rows ordered by `updatedAt,desc`, then `id,desc`.
167. Replace saved search: owner sends `PUT /api/students/me/saved-searches/{id}` with complete content; expect all criteria replaced without ownership change.
168. Delete saved search: owner sends `DELETE /api/students/me/saved-searches/{id}`; expect only the saved-search row removed and unrelated student/job/recommendation data unchanged.
169. Foreign saved search: another student attempts PUT and DELETE; expect `404 SAVED_SEARCH_NOT_FOUND`, identical to an absent id.
170. Saved-search duplicate: create names differing only by case for one student; expect `409 SAVED_SEARCH_ALREADY_EXISTS`. Use the same name for another student; expect success.
171. Saved-search validation: test blank/over-100 name, over-255 criteria, and unknown enums; expect a `400` validation or malformed-body error.
172. Password role access: `STUDENT`, `COMPANY`, and `ADMIN` each send `PATCH /api/users/me/password`; expect success only for their authenticated user.
173. Invalid current password: send a wrong current password; expect `400 INVALID_CURRENT_PASSWORD` and an unchanged hash.
174. Password policy: test fewer than 6 characters, more than 72 UTF-8 bytes (including multibyte input), and a new password equal to the current password; expect rejection.
175. Password persistence and login: verify the stored value is encoded, old credentials no longer authenticate, and new credentials do.
176. Password response privacy: verify neither plaintext field nor `passwordHash` appears in success or error responses.
177. Stateless-token behavior: reuse an access token issued before password change; it remains valid until expiry. Confirm future logins require the new password.
178. Unauthenticated password change: call without a token; expect `401 UNAUTHORIZED`.

## CV Analysis and Recommendation Integration

Run a contract-compatible local AI stub at `APP_AI_SERVICE_BASE_URL` (default `http://localhost:8000`). The stub must expose multipart `POST /internal/v1/cv/parse` and JSON `POST /internal/v1/recommendations`. Use two students, one company and admin, verified/pending companies, jobs across statuses/deadlines, and CVs with physical test files.

179. Analysis owner read: student token calls `GET /api/students/me/cv/{cvId}/analysis`; expect owned CV text, normalized current student skills, derived `READY`/`NOT_READY`, timestamps, and no storage or ownership identifiers.
180. Analysis hidden ownership: another student and a missing id call the same endpoint; expect byte-identical `404 RESOURCE_NOT_FOUND` envelopes.
181. Extracted-data patch: owner sends trimmed `extractedText` and/or `processedText` to `PATCH /api/students/me/cv/{cvId}/extracted-data`; expect only supplied supported fields updated.
182. Extracted-data strict JSON: send `skills`, `studentId`, `userId`, or another unknown field; expect `400 BAD_REQUEST` and no update.
183. Extracted-data size/empty validation: exceed 1,000,000 characters or send no supported field; expect `400` and unchanged persisted text.
184. Reanalysis success: configure parse success with `rawText`, `processedText`, and `skills`; call `POST /api/students/me/cv/{cvId}/reanalyze`; expect text persisted and an updated analysis response.
185. Reanalysis multipart privacy: inspect the stub request; expect only the CV multipart file and content metadata, with no JWT, database credential, student id, storage directory, or absolute path.
186. Reanalysis preserves skills: create manual and existing CV-derived student skills, reanalyze, and verify none are inserted, replaced, or deleted because the current schema has no CV-to-skill association.
187. Reanalysis failure atomicity: return timeout, connection failure, HTTP 4xx/5xx, malformed JSON, blank/oversized processed text, null skills, or invalid skill values; expect a mapped AI error and unchanged persisted CV text.
188. Generate validation/defaults: send only positive `cvId`; inspect the stub request for `threshold: 0.1` and `limit: 20`. Test threshold outside `0.0..1.0`, limit outside `1..100`, and non-positive/missing CV id; expect `400`.
189. Generate strict ownership: send `studentId`, `userId`, or another unknown property; expect `400 BAD_REQUEST`. Select another student's CV and an absent CV; expect indistinguishable `404 RESOURCE_NOT_FOUND` responses and no run.
190. Generate role: company/admin tokens call generation; expect `403 ACCESS_DENIED`.
191. Analysis readiness: select a CV with null/blank `processedText`; expect `409 CV_ANALYSIS_NOT_READY` and no run.
192. Eligible corpus: create active verified null/today/future-deadline jobs plus draft, closed, expired, and unverified-company jobs; inspect the AI request and expect only the first group, deterministically ordered by job id.
193. Corpus text/skills: verify each submitted job combines title, description, requirements, and sorted normalized skill names; increasing job count must not add one database skill query per job.
194. No JWT forwarding: inspect recommendation request headers/body; expect no user access token, `studentId`, or `userId`.
195. Processing visibility: block the AI stub after it receives the request; from a separate database connection verify a committed `PROCESSING` run, then release the response.
196. Successful generation: return a valid matching `requestId`; expect a `SUCCESS` run, non-null `finishedAt`, and one stored result per returned eligible job.
197. Empty success: return `results: []`; expect `SUCCESS`, zero stored results, and `totalRecommended: 0`.
198. Deterministic ranking: return valid results in arbitrary order with score ties; expect storage and response sorted by score descending then job id ascending and ranks recalculated from 1.
199. Score storage: exercise exact `0.0`, exact `1.0`, and an in-range fractional score; expect PostgreSQL `NUMERIC(8,5)` values from `0.00000` through `1.00000`.
200. Invalid recommendation contract: separately return mismatched request id, null results, null/unknown/duplicate job id, null/out-of-range/NaN/infinite score, null/non-positive/duplicate/non-contiguous rank, excessive results, and null/oversized matched skill; expect `AI_SERVICE_INVALID_RESPONSE`.
201. Failure atomicity: after case 200, expect no partial results, a `FAILED` run with `finishedAt`, and a fixed sanitized message containing no response body, exception class, URL credential, local path, JWT, or CV text.
202. Transport mapping: exercise timeout, connection refusal, HTTP 4xx, HTTP 5xx, and malformed JSON; expect the documented `AI_SERVICE_TIMEOUT`, `AI_SERVICE_UNAVAILABLE`, or `AI_SERVICE_INVALID_RESPONSE` envelope and a `FAILED` run.
203. Independent runs: send two concurrent valid generation requests; expect two independent runs and no cross-run result corruption.
204. Run detail owner: call `GET /api/students/me/recommendation-runs/{runId}`; expect run lifecycle fields and ordered results.
205. Run detail hidden ownership: another student and an absent id call detail; expect byte-identical `404 RECOMMENDATION_RUN_NOT_FOUND` envelopes.
206. Existing history compatibility: after generation, call `GET /api/students/me/recommendation-runs` and `GET /api/students/me/recommendation-results/latest`; expect the persisted run/results through the existing response envelope.
