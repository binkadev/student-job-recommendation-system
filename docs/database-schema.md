# Database Schema

PostgreSQL is the system of record. Flyway migrations under `backend/src/main/resources/db/migration` are the primary source of truth.

Current schema version: **V1 through V15**.

Released migrations must never be edited. New schema changes require a new migration.

## Schema overview

The current database contains 17 business tables:

1. `users`
2. `students`
3. `student_profiles`
4. `companies`
5. `skills`
6. `student_skills`
7. `jobs`
8. `job_skills`
9. `saved_jobs`
10. `saved_searches`
11. `cv_files`
12. `applications`
13. `saved_candidates`
14. `recommendation_runs`
15. `recommendation_results`
16. `notifications`
17. `user_notification_settings`

The canonical DBML source is [`database-erd.dbml`](database-erd.dbml).

## Identity and profiles

### `users`

Authentication root for students, companies, and administrators.

Columns:

- `id`
- `email`
- `password_hash`
- `full_name`
- `phone`
- `role`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

Rules:

- unique `email`;
- roles: `STUDENT`, `COMPANY`, `ADMIN`;
- statuses: `ACTIVE`, `INACTIVE`, `BLOCKED`.

### `students`

Student aggregate root linked one-to-one to `users` through unique `user_id`.

Columns include `student_code`, `university`, `major`, `graduation_year`, and `location`.

### `student_profiles`

User-confirmed structured profile and profile text.

Unique `student_id` gives one profile row per student.

Columns include:

- `headline`
- `summary`
- `education_level`
- `gpa`
- `preferred_job_type`
- `preferred_working_model`
- `preferred_location`
- `education`
- `experience`
- `projects`
- `target_position`
- `raw_text`
- `processed_text`
- `profile_completeness`

### `companies`

Company aggregate root linked one-to-one to `users` through unique `user_id`.

Columns include company identity, tax, website, industry, size, description, address, phone, and status.

Company statuses: `PENDING`, `VERIFIED`, `BLOCKED`.

## Skills

### `skills`

Canonical skill catalog.

Important fields:

- `name`
- `normalized_name`
- `category`
- `description`

`name` is unique. `normalized_name` has a partial unique index where non-null.

### `student_skills`

Confirmed student skill relationship.

Rules:

- unique `(student_id, skill_id)`;
- skill level and source are persisted;
- this table does **not** replace CV-specific extracted skills.

### `job_skills`

Declared skill requirements for a job.

Rules:

- unique `(job_id, skill_id)`;
- fields include `importance` and `min_level`;
- AI Contract V2 currently sends canonical names only; importance/minimum level remain future scoring inputs.

## Jobs and saved data

### `jobs`

Company-owned job postings with title, description, requirements, benefits, location, type, working model, status, salary, currency, deadline, and publication/closure timestamps.

Public/recommendation visibility requires:

- job status `ACTIVE`;
- owning company status `VERIFIED`;
- deadline null, today, or future.

### `saved_jobs`

Student bookmark relation.

Unique `(student_id, job_id)`.

### `saved_searches`

Named student search filters.

A case-insensitive unique index enforces one name per student:

```sql
UNIQUE (student_id, lower(name))
```

## CV and application domain

### `cv_files`

Backend-owned CV metadata, storage pointers, extracted text, and persisted AI-analysis state.

Core file fields:

- `student_id`
- `file_name`
- `original_file_name`
- `stored_file_name`
- `file_url`
- `file_path`
- `content_type`
- `file_size`
- `is_active`
- timestamps

AI analysis fields added through V15:

- `extracted_text`
- `processed_text`
- `extracted_skills JSONB`
- `analysis_status`
- `analysis_error`
- `language_code`
- `language_confidence`
- `processing_version`
- `analysis_warnings JSONB`
- `analyzed_at`

Analysis statuses:

- `NOT_READY`
- `PROCESSING`
- `READY`
- `FAILED`

Rules:

- partial unique index allows at most one active CV per student;
- extracted skills belong to that specific CV;
- `student_skills` is never used as a fallback for selected-CV skills;
- internal paths and stored filenames are never exposed by public DTOs.

### `applications`

Student application to a job with optional CV reference.

Rules:

- unique `(student_id, job_id)`;
- one student cannot apply to the same job twice;
- `cv_file_id` is nullable for legacy/optional cases;
- status transitions are enforced by Backend business logic.

### `saved_candidates`

Recruiter bookmark for a candidate, created from an owned application.

Rules:

- unique `(company_id, student_id)`;
- `application_id` records the source application;
- the domain remains **Saved Candidate**, not Saved Application;
- Backend verifies the application belongs to the same company and student relationship.

## Recommendation domain

### `recommendation_runs`

One persisted recommendation attempt for a student and optional selected CV.

Fields:

- `student_id`
- `cv_file_id`
- `source_type`
- `status`
- `algorithm`
- `algorithm_version`
- `total_jobs_scanned`
- `started_at`
- `finished_at`
- `error_message`
- audit timestamps

Statuses: `PROCESSING`, `SUCCESS`, `FAILED`.

The latest-results query uses the latest `SUCCESS` run, not simply the newest run.

### `recommendation_results`

One persisted job result per run.

Fields:

- `run_id`
- `job_id`
- `score`
- `text_score`
- `skill_score`
- `scoring_strategy`
- `matched_keywords JSONB`
- `missing_skills JSONB`
- `reason`
- `rank_position`
- audit timestamps

Rules:

- unique `(run_id, job_id)`;
- scores are constrained to `[0,1]` when present;
- strategies: `SAME_LANGUAGE_HYBRID`, `CROSS_LANGUAGE_SKILL_BASED`;
- `matched_keywords` is retained for public compatibility and semantically means matched skills;
- AI returns no rank;
- Backend sorts by `score DESC`, then `jobId ASC`, and assigns `rank_position`.

## Notifications

### `notifications`

Persistent in-app notifications owned by a user.

`reference_type` and `reference_id` form a polymorphic logical reference. `reference_id` intentionally has no physical foreign key because it may identify an application, job, or recommendation run.

### `user_notification_settings`

One settings row per user through unique `user_id`.

Fields control application-status, job-status, recommendation, and system notifications. A missing row means all settings are enabled by default at the service layer.

## Key relationships

- `users 1 — 0..1 students`
- `users 1 — 0..1 companies`
- `users 1 — 0..1 user_notification_settings`
- `users 1 — * notifications`
- `students 1 — 0..1 student_profiles`
- `students 1 — * student_skills`
- `students 1 — * cv_files`
- `students 1 — * applications`
- `students 1 — * saved_jobs`
- `students 1 — * saved_searches`
- `students 1 — * recommendation_runs`
- `companies 1 — * jobs`
- `companies 1 — * saved_candidates`
- `jobs 1 — * job_skills`
- `jobs 1 — * applications`
- `jobs 1 — * recommendation_results`
- `recommendation_runs 1 — * recommendation_results`

## Important indexes and checks

- `skills.normalized_name` unique where non-null;
- `cv_files(student_id)` unique where `is_active = true`;
- `saved_searches(student_id, lower(name))` unique;
- CV analysis status/language/confidence checks from V15;
- recommendation score and strategy checks from V15;
- `(student_id, status, created_at DESC, id DESC)` index for latest successful recommendation runs.

## Ownership and privacy

Database foreign keys establish structural relationships, while Backend services enforce authenticated ownership and cross-aggregate consistency.

Public APIs never expose:

- password hashes;
- CV physical paths;
- stored filenames;
- storage directories;
- internal database credentials.

The AI Service is stateless and has no application database tables or direct database access.
