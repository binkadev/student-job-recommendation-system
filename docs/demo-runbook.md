# Candidate Ranking Demo Runbook

Use a clean local environment and only approved demo data. Keep passwords,
JWTs, internal keys, raw CV text, and private files off screen.

| Stage | Actions on screen | What the presenter says | Expected evidence |
|---|---|---|---|
| 1. Pre-demo | Confirm Docker, `.env`, clean stack, demo accounts, approved CV files, and a Company-owned Job with declared skills. | “This is a local demo; ranking is decision support.” | Commit, service versions, and fixture are known. |
| 2. Clean startup | Run `docker compose up --build -d`, start Frontend, open the app. | “Frontend calls Backend; Backend connects to PostgreSQL and AI.” | Healthy Compose services and Frontend URL. |
| 3. Health | Open AI `/health`, Backend `/api/public/statistics`, and `docker compose ps`. | “These prove liveness only, not production readiness.” | HTTP 200 and healthy containers. |
| 4. Company login | Sign in as the local Company account. | “JWT authorization is enforced by Backend.” | Company dashboard loads without showing the token. |
| 5. Job | Open or create a Job and ensure required skills such as Java, Spring Boot, PostgreSQL, and Docker are declared. | “The ranking scope is one owned Job, not a global candidate search.” | Job id, owner, status, and declared skills. |
| 6. Eligible applications | Open the Job’s Applications and confirm submitted CVs are present and analysis status is `READY`; confirm pending/reviewed applications are eligible. | “Backend uses the submitted CV for that application, not whichever CV is currently active.” | Application/CV status and skip counters. |
| 7. Candidate Ranking | Open `/recruiter/jobs/{jobId}/candidate-ranking`. | “The page is a Backend client; it does not score locally.” | Candidate Ranking page and Job identity. |
| 8. Run | Set threshold, for example `0.30`, and a limit between 1 and 100; click “Chạy xếp hạng”. | “Threshold filters results; limit is Top K after the full eligible corpus is evaluated.” | POST completes as `SUCCESS`, or a visible safe error. |
| 9. Loading | If status is `PROCESSING`, observe the loading state and wait for refresh. | “The current contract is synchronous, but the UI handles processing state.” | `PROCESSING`/`SUCCESS` state transition when applicable. |
| 10. Scores | Point to score, `textScore`, and `skillScore`. | “Score is the final match score; components explain lexical and skill overlap.” | Score values in range 0–1. |
| 11. Same language | Select an English-English or Vietnamese-Vietnamese result. | “With declared skills, `0.65 × textScore + 0.35 × skillScore`; without skills, score is textScore.” | `SAME_LANGUAGE_HYBRID`. |
| 12. Cross language | Select a result whose CV and Job languages differ or confidence is insufficient. | “Cross-language uses canonical skill overlap only; `textScore` is null.” | `CROSS_LANGUAGE_SKILL_BASED`. |
| 13. Skills/reason | Open analysis for a result. | “Matched and missing skills are Backend-presented facts from validated AI output; reason is Backend-generated.” | Sorted matched/missing lists and bounded reason. |
| 14. Rank | Point to `#1`, `#2`, etc. | “AI does not assign public rank. Backend validates, sorts score descending then application id ascending, and assigns continuous rank.” | Continuous `rankPosition`. |
| 15. CV | Click “CV”. | “This is an authorized company application CV stream; storage paths are not exposed.” | CV opens without showing server path. |
| 16. Save | Click “Lưu” for a candidate. | “Saved Candidate is company-plus-student scoped and uses the application as source.” | Success toast and saved state. |
| 17. Status | Change an application to `REVIEWED`, `ACCEPTED`, or `REJECTED` as appropriate. | “Application state is a Backend business transition.” | Updated status and safe confirmation. |
| 18. History | Open “Xem lịch sử” and select an older run. | “History is persisted; an explicitly selected older success is labeled historical.” | Run list and historical warning. |
| 19. Zero result | Run with a high threshold or use a Job with no eligible READY applications. | “Zero results is valid; it is not automatically an error.” | `SUCCESS`, zero results, counters, no fake candidate. |
| 20. Fallback | If live demo fails, show sanitized local test output, the isolated E2E evidence, contract, and architecture documents. | “I distinguish executable evidence from documentation-only claims.” | No invented pass claim; record the failure. |

## Presenter reminders

- Do not call TF-IDF a trained deep-learning model.
- Do not claim BERT, LLM, embeddings, or learning-to-rank.
- Do not use the isolated fixture as a human ranking-quality study.
- State that manual full Student/Company/Admin E2E remains separate unless it
  has been actually run and recorded.
