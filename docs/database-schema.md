# Database Schema

The implemented database is PostgreSQL managed by Flyway migrations under `backend/src/main/resources/db/migration`.

Old migrations must not be edited after being applied. This document describes the released schema from `V1` through `V18` at source SHA `131a4b869a3248dd08475c5da84989be23ce8ac9`; it does not certify which migrations a deployed environment has applied.

All 19 business tables use `BIGSERIAL` primary key `id` and non-null `created_at`/`updated_at` timestamps defaulting to `CURRENT_TIMESTAMP`. All released foreign keys use `ON DELETE RESTRICT`. Types, defaults and column nullability are also shown in [the DBML](database-erd.dbml); omitted `not null` means nullable. VARCHAR enum values in application code are not automatically database CHECK constraints.

Migration coverage: V1 users; V2 Student/profile/Company; V3 skills; V4 Jobs/Job skills/saved Jobs; V5 CVs/Applications; V6 recommendations; V7 indexes; V8 login timestamp; V9 profile extensions; V10 CV storage/active flag; V11 skill normalization; V12 notifications; V13 saved Candidates/settings; V14 saved searches; V15 CV analysis/recommendation V2 metadata; V16 Candidate Ranking; V17 V3 tier/score/limit semantics; V18 active-application uniqueness. See [released migrations](../backend/src/main/resources/db/migration/).

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

`education_level` and `gpa` exist in DB/JPA but are not exposed or updated by the current public profile DTOs. Profile text/manual skills are separate from CV analysis and are not V3 scoring input. These fields do not imply structured major/experience/education extraction from a CV.

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

Purpose: CV storage metadata and persisted machine analysis from the existing V2 parsing pipeline.

Columns: `id`, `student_id`, `file_name`, `original_file_name`, `stored_file_name`, `file_url`, `file_path`, `content_type`, `file_size`, `extracted_text`, `processed_text`, `extracted_skills`, `analysis_status`, `analysis_error`, `language_code`, `language_confidence`, `processing_version`, `analysis_warnings`, `analyzed_at`, `is_active`, `uploaded_at`, `created_at`, `updated_at`.

V15 analysis fields:

| Column | Type / nullability / default | Meaning / released CHECK |
|---|---|---|
| `extracted_skills` | JSONB NOT NULL, default `[]` | Per-CV extracted canonical skill strings; separate from `student_skills` |
| `analysis_status` | VARCHAR(30) NOT NULL, default `NOT_READY` | CHECK: `NOT_READY`, `PROCESSING`, `READY`, `FAILED` |
| `analysis_error` | TEXT nullable | Sanitized failure message |
| `language_code` | VARCHAR(20) nullable | CHECK: null or `en`, `vi`, `mixed`, `unknown` |
| `language_confidence` | NUMERIC(5,4) nullable | CHECK: null or [0,1] |
| `processing_version` | VARCHAR(100) nullable | Current parser version `bilingual-nlp-v2-skills-v1`; no DB version allowlist |
| `analysis_warnings` | JSONB NOT NULL, default `[]` | Analysis warning strings |
| `analyzed_at` | TIMESTAMP nullable | Successful analysis time |

V15 backfills `READY` only where both old text fields are nonblank, otherwise `NOT_READY`; it does not invent language/version/skills. Such a historical READY row can still fail V3 readiness. V3 requires owned selected CV, READY, nonblank processed text/language code, confidence [0,1], and the exact compatible processing version; empty extracted skills are allowed. It does not require raw `extracted_text` for scoring, detect CV language again, or preprocess CV text again. JSONB array shape is validated by the application here; V15 does not create JSON array CHECKs for these CV fields.

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
- V18 partial unique index: `uk_applications_student_job_active` on `(student_id, job_id)` where `status IN ('PENDING', 'REVIEWED', 'ACCEPTED')`; V5's lifetime pair constraint is dropped.
- Foreign keys: `student_id -> students.id`, `job_id -> jobs.id`, `cv_file_id -> cv_files.id`
- Indexes: `student_id`, `job_id`, `status`

Service lifecycle: an existing PENDING/REVIEWED/ACCEPTED row blocks apply (`409 APPLICATION_ALREADY_ACTIVE`). Otherwise a first application is allowed; reapplication requires the latest row by `applied_at DESC, id DESC` to be REJECTED. Latest WITHDRAWN still blocks reapply (`400 BAD_REQUEST`). Reapply inserts a new PENDING row and preserves rejected history. Job must be ACTIVE with no past deadline; a supplied CV must belong to the Student. The index does not enforce the latest-REJECTED rule or cross-row CV ownership; those are Backend checks. Evidence: [service](../backend/src/main/java/com/tttn/jobrecommendation/modules/application/service/ApplicationServiceImpl.java), [reapply API tests](../backend/src/test/java/com/tttn/jobrecommendation/integration/ApplicationReapplyApiIT.java), [constraint tests](../backend/src/test/java/com/tttn/jobrecommendation/integration/DatabaseConstraintIT.java).

### `recommendation_runs`

Purpose: Student recommendation run lifecycle and metadata, including current V3 and historical runs.

Columns: `id`, `student_id`, `cv_file_id`, `source_type`, `status`, `algorithm`, `algorithm_version`, `total_jobs_scanned`, `started_at`, `finished_at`, `error_message`, `created_at`, `updated_at`.

V15 adds nullable VARCHAR(100) algorithm/version and non-null INTEGER `total_jobs_scanned` default 0, CHECK >=0. `cv_file_id`, `finished_at`, and `error_message` are nullable. New runs use source CV and PROCESSING -> SUCCESS/FAILED; legacy algorithm/version may be null. Student runs do not store threshold, requested limit, request UUID, CV-version snapshot, or corpus fingerprint.

Constraints and indexes:

- Primary key: `id`
- Foreign keys: `student_id -> students.id`, `cv_file_id -> cv_files.id`
- Indexes: `student_id`, `status`; V15 `idx_recommendation_runs_student_status_created_at` on `(student_id, status, created_at DESC, id DESC)`

### `recommendation_results`

Purpose: persisted recommendation result rows for read-only APIs.

Columns: `id`, `run_id`, `job_id`, `score`, `text_score`, `skill_score`, `scoring_strategy`, `matched_keywords`, `missing_skills`, `reason`, `overall_score`, `ranking_tier`, `rank_position`, `tier_rank_position`, `created_at`, `updated_at`.

`score` is NOT NULL NUMERIC(8,5), mapped to Java/public `rankingScore`; no physical `ranking_score` column exists. V15 adds nullable `text_score`/`skill_score` NUMERIC(8,5), nullable `scoring_strategy` VARCHAR(50), nullable `reason` TEXT, and NOT NULL `missing_skills` JSONB default `[]`. `matched_keywords` remains nullable JSONB and contains matched skill evidence. V17 adds nullable `overall_score` NUMERIC(8,5), `ranking_tier` VARCHAR(20), and `tier_rank_position` INTEGER. `rank_position` remains NOT NULL INTEGER.

Constraints and indexes:

- Primary key: `id`
- Unique: `(run_id, job_id)`
- Foreign keys: `run_id -> recommendation_runs.id`, `job_id -> jobs.id`
- Indexes: `job_id`, `score DESC`

- V17 partial unique `uk_recommendation_results_run_tier_rank` on `(run_id, ranking_tier, tier_rank_position)` where both tier and tier rank are non-null.
- There is no Student UNIQUE `(run_id, rank_position)` or released positive-rank CHECK on `rank_position`; Backend assigns continuous official ranks. See shared V3 constraints below.

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

### `saved_candidates` (V13)

Purpose: Company bookmark of a Student, with the source Application.

Columns: `id`, `company_id`, `student_id`, `application_id`, `note`, `created_at`, `updated_at`.

All three FK columns are BIGINT NOT NULL, referencing `companies`, `students`, and `applications` respectively. `note` is nullable TEXT. UNIQUE `uk_saved_candidates_company_student` is `(company_id, student_id)`; `application_id` is not unique. No extra indexes or cross-column ownership CHECKs are created by V13.

### `user_notification_settings` (V13)

Columns: `id`, `user_id`, `application_status_enabled`, `job_status_enabled`, `recommendation_enabled`, `system_enabled`, `created_at`, `updated_at`.

`user_id` is BIGINT NOT NULL, FK to `users.id`, UNIQUE `uk_user_notification_settings_user_id`. All four preference columns are BOOLEAN NOT NULL default TRUE. A missing row is treated as enabled by Backend; GET does not create it. Only application-status changes currently have an automatic notification producer.

### `saved_searches` (V14)

Columns: `id`, `student_id`, `name`, `keyword`, `location`, `job_type`, `working_model`, `created_at`, `updated_at`.

`student_id` is BIGINT NOT NULL, FK to `students.id`; `name` is VARCHAR(100) NOT NULL. Optional `keyword`/`location` are VARCHAR(255); optional `job_type`/`working_model` are VARCHAR(50). Expression unique index `uk_saved_searches_student_name_ci` is `(student_id, lower(name))`, not ordinary case-sensitive `(student_id, name)` uniqueness. V14 adds no enum CHECKs.

### `candidate_ranking_runs` (V16/V17)

Purpose: Company-owned Job ranking run, including fingerprint, counters and requested limits.

Columns: `id`, `job_id`, `request_id`, `status`, `algorithm`, `algorithm_version`, `threshold`, `requested_limit`, `requested_primary_limit`, `requested_fallback_limit`, `total_applications_scanned`, `eligible_candidates`, `skipped_no_cv`, `skipped_not_ready`, `skipped_terminal_status`, `input_fingerprint`, `job_updated_at_snapshot`, `started_at`, `finished_at`, `error_message`, `created_at`, `updated_at`.

| Fields | Released type / constraints |
|---|---|
| `job_id` | BIGINT NOT NULL FK to `jobs.id` |
| `request_id` | UUID NOT NULL; UNIQUE `uk_candidate_ranking_runs_request_id` |
| `status` | VARCHAR(50) NOT NULL; CHECK PROCESSING/SUCCESS/FAILED |
| `algorithm`, `algorithm_version` | VARCHAR(100) nullable |
| `threshold` | NUMERIC(8,5) NOT NULL; CHECK [0,1] |
| `requested_limit` | INTEGER nullable after V17; if non-null CHECK [1,100] |
| `requested_primary_limit`, `requested_fallback_limit` | V17 INTEGER nullable; if non-null CHECK [0,100] |
| All five counters | INTEGER NOT NULL default 0; each >=0; scanned = eligible + all three skipped counts |
| `input_fingerprint` | VARCHAR(64) NOT NULL; CHECK length exactly 64 |
| `job_updated_at_snapshot` | TIMESTAMP NOT NULL |
| `started_at` | TIMESTAMP NOT NULL default CURRENT_TIMESTAMP |
| `finished_at`, `error_message` | Nullable TIMESTAMP / TEXT |

V17 limit-shape CHECK allows exactly one shape: legacy non-null requested_limit with both tier limits null; or requested_limit null with both tier limits non-null and their sum in [1,100]. It preserves historical V2 limits rather than inventing independent tier limits.

Partial unique index `uk_candidate_ranking_runs_job_processing` on `(job_id)` where `status = 'PROCESSING'` permits only one processing run per Job. Index `idx_candidate_ranking_runs_job_status_created_at` is `(job_id, status, created_at DESC, id DESC)`.

### `candidate_ranking_results` (V16/V17)

Columns: `id`, `run_id`, `application_id`, `cv_file_id`, `score`, `text_score`, `skill_score`, `scoring_strategy`, `matched_skills`, `missing_skills`, `reason`, `rank_position`, `overall_score`, `ranking_tier`, `tier_rank_position`, `cv_processing_version`, `cv_analyzed_at_snapshot`, `created_at`, `updated_at`.

`run_id`, `application_id`, and `cv_file_id` are BIGINT NOT NULL FKs to Candidate runs, Applications, and CVs. `score` and `skill_score` are NUMERIC(8,5) NOT NULL; text/overall scores are nullable NUMERIC(8,5). Strategy is VARCHAR(50) NOT NULL. Matched/missing skills are JSONB NOT NULL default `[]`, each with a JSON-array CHECK. `reason` is nullable TEXT; CV processing version is nullable VARCHAR(100), analyzed-at snapshot nullable TIMESTAMP. Global rank is INTEGER NOT NULL CHECK >0; V17 tier VARCHAR(20) and tier rank INTEGER remain nullable for history.

UNIQUE `(run_id, application_id)` and `(run_id, rank_position)` are released V16 constraints. V17 adds partial unique `uk_candidate_ranking_results_run_tier_rank` on `(run_id, ranking_tier, tier_rank_position)` where both tier and tier rank are non-null. It does not add a unique CV pair constraint.

## Shared V3 result semantics and database boundaries (V15–V17)

Both result tables CHECK score and non-null component scores in [0,1], strategy (if present) in SAME_LANGUAGE_HYBRID/CROSS_LANGUAGE_SKILL_BASED, tier (if present) in PRIMARY/FALLBACK, and non-null tier rank >0. Candidate results additionally enforce strategy/text nullability even without a V3 tier. Student strategy/skill fields remain nullable for older records.

V17 tier CHECKs permit null tier for history; otherwise PRIMARY requires SAME_LANGUAGE_HYBRID, non-null text/overall, and `overall_score = score`; FALLBACK requires CROSS_LANGUAGE_SKILL_BASED with null text/overall. PostgreSQL CHECKs accept UNKNOWN as well as TRUE: these checks do not make nullable Student strategy/skill/tier-rank fields universally NOT NULL. New V3 completeness, skill coverage, FALLBACK `score = skill_score`, and the 0.65/0.35 formula are validated by Backend, not fully enforced by these DB CHECKs.

V3 Backend assigns global `rankPosition` and independent `tierRankPosition`. Student uses PRIMARY first, descending score then ascending Job id within tiers and one global limit. Company uses independent tier limits and descending score then ascending Application id within each tier; global rank is deterministic PRIMARY-then-FALLBACK persistence order. Physical `score` maps to `rankingScore`; public `score` remains its deprecated alias. FALLBACK skill coverage is not calibrated overall fit.

V17 backfills only recognized strategy/text combinations: PRIMARY gets `overall_score = score`; FALLBACK gets null overall. Per-tier ranks are backfilled by score DESC then job_id/application_id ASC. Global historical ranks are not rewritten; incomplete history deliberately retains null tier metadata. See [V3 migration tests](../backend/src/test/java/com/tttn/jobrecommendation/integration/DatabaseRecommendationRankingV3MigrationIT.java), [persistence tests](../backend/src/test/java/com/tttn/jobrecommendation/integration/RecommendationV3PersistenceIT.java), and [active V3 contract](recommendation-ranking-v3-contract.md).

DBML notes preserve PostgreSQL partial predicates, expression uniqueness, descending index keys, and CHECK semantics; an ordinary DBML unique index must not be substituted for conditional Application, active-CV, processing-run, or tier-rank uniqueness. Notification reference_type/reference_id are polymorphic metadata without extra FKs. No speculative constraints/indexes are implied.

## Enum Storage

Enums are stored as `VARCHAR`.

Final job domain:

- `jobs.job_type`: `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `CONTRACT`
- `jobs.working_model`: `ONSITE`, `HYBRID`, `REMOTE`

`REMOTE` is a working model only.
