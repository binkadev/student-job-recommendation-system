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
