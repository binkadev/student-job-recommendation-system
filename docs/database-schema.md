# Database Schema

The implemented database is PostgreSQL managed by Flyway migrations under `backend/src/main/resources/db/migration`.

Old migrations must not be edited after being applied. Current migrations are `V1` through `V11`.

## Tables

### `users`

Purpose: authentication users and role/status ownership.

Columns: `id`, `email`, `password_hash`, `full_name`, `phone`, `role`, `status`, `last_login_at`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `email`
- Indexes: `role`, `status`, `last_login_at`

### `students`

Purpose: student account profile root linked one-to-one to `users`.

Columns: `id`, `user_id`, `student_code`, `university`, `major`, `graduation_year`, `location`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `user_id`
- Foreign key: `user_id -> users.id`

### `student_profiles`

Purpose: user-confirmed structured student profile data and search text.

Columns: `id`, `student_id`, `headline`, `summary`, `education_level`, `gpa`, `preferred_job_type`, `preferred_working_model`, `preferred_location`, `education`, `experience`, `projects`, `target_position`, `raw_text`, `processed_text`, `profile_completeness`, `created_at`, `updated_at`.

Constraints:

- Primary key: `id`
- Unique: `student_id`
- Foreign key: `student_id -> students.id`

### `companies`

Purpose: company profile linked one-to-one to `users`.

Columns: `id`, `user_id`, `company_name`, `tax_code`, `website_url`, `logo_url`, `industry`, `company_size`, `description`, `address`, `phone`, `status`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `user_id`
- Foreign key: `user_id -> users.id`
- Indexes: `status`, `company_name`

### `skills`

Purpose: normalized skill catalog.

Columns: `id`, `name`, `normalized_name`, `category`, `description`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `name`
- Partial unique index: `normalized_name` where not null
- Index: `category`

### `student_skills`

Purpose: confirmed structured student skills.

Columns: `id`, `student_id`, `skill_id`, `level`, `source`, `years_of_experience`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `(student_id, skill_id)`
- Foreign keys: `student_id -> students.id`, `skill_id -> skills.id`
- Index: `skill_id`

### `jobs`

Purpose: company-owned jobs.

Columns: `id`, `company_id`, `title`, `description`, `requirements`, `benefits`, `location`, `job_type`, `working_model`, `status`, `salary_min`, `salary_max`, `currency`, `deadline`, `published_at`, `closed_at`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Foreign key: `company_id -> companies.id`
- Indexes: `company_id`, `status`, `job_type`, `working_model`, `deadline`

### `job_skills`

Purpose: skills required or preferred by a job.

Columns: `id`, `job_id`, `skill_id`, `importance`, `min_level`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `(job_id, skill_id)`
- Foreign keys: `job_id -> jobs.id`, `skill_id -> skills.id`
- Index: `skill_id`

### `saved_jobs`

Purpose: student saved-job relationship.

Columns: `id`, `student_id`, `job_id`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `(student_id, job_id)`
- Foreign keys: `student_id -> students.id`, `job_id -> jobs.id`
- Index: `job_id`

### `cv_files`

Purpose: CV metadata and future machine-extracted text storage.

Columns: `id`, `student_id`, `file_name`, `original_file_name`, `stored_file_name`, `file_url`, `file_path`, `content_type`, `file_size`, `extracted_text`, `processed_text`, `is_active`, `uploaded_at`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Foreign key: `student_id -> students.id`
- Index: `student_id`
- Partial unique index: `student_id` where `is_active = TRUE`

Ownership rule:

- `cv_files.extracted_text` is machine-extracted raw content.
- `student_profiles` and `student_skills` are user-confirmed structured data.

### `applications`

Purpose: student job applications.

Columns: `id`, `student_id`, `job_id`, `cv_file_id`, `status`, `cover_letter`, `applied_at`, `reviewed_at`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `(student_id, job_id)`
- Foreign keys: `student_id -> students.id`, `job_id -> jobs.id`, `cv_file_id -> cv_files.id`
- Indexes: `student_id`, `job_id`, `status`

### `recommendation_runs`

Purpose: recommendation run metadata skeleton.

Columns: `id`, `student_id`, `cv_file_id`, `source_type`, `status`, `started_at`, `finished_at`, `error_message`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Foreign keys: `student_id -> students.id`, `cv_file_id -> cv_files.id`
- Indexes: `student_id`, `status`

### `recommendation_results`

Purpose: persisted recommendation result rows for read-only APIs.

Columns: `id`, `run_id`, `job_id`, `score`, `matched_keywords`, `rank_position`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Unique: `(run_id, job_id)`
- Foreign keys: `run_id -> recommendation_runs.id`, `job_id -> jobs.id`
- Indexes: `job_id`, `score DESC`

### `notifications`

Purpose: persistent in-app notifications for authenticated users.

Columns: `id`, `user_id`, `type`, `title`, `message`, `reference_type`, `reference_id`, `is_read`, `read_at`, `created_at`, `updated_at`.

Constraints and indexes:

- Primary key: `id`
- Foreign key: `user_id -> users.id`
- Indexes: `user_id`, `(user_id, is_read)`, `created_at`

Current automatic event:

- `APPLICATION_STATUS_CHANGED` for the student when company/admin status changes an application.

Not implemented:

- Realtime delivery
- Email/push notifications
- Recommendation matching-job notifications
- Account-blocked persistent notifications

## Enum Storage

Enums are stored as `VARCHAR`.

Final job domain:

- `jobs.job_type`: `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `CONTRACT`
- `jobs.working_model`: `ONSITE`, `HYBRID`, `REMOTE`

`REMOTE` is a working model only.
