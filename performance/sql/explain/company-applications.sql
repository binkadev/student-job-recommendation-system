\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

\echo __PLAN_content_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT
  a.id, a.student_id, a.job_id, a.cv_file_id, a.status, a.cover_letter,
  a.applied_at, a.reviewed_at, a.created_at, a.updated_at
FROM applications AS a
JOIN jobs AS j ON j.id = a.job_id
WHERE j.company_id = 1
ORDER BY a.applied_at DESC
OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY;
\echo __PLAN_content_END__

\echo __PLAN_count_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT count(a.id)
FROM applications AS a
JOIN jobs AS j ON j.id = a.job_id
WHERE j.company_id = 1;
\echo __PLAN_count_END__

\echo __PLAN_secondary_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT
  j.id, j.company_id, j.title, j.description, j.requirements, j.benefits,
  j.location, j.job_type, j.working_model, j.status, j.salary_min,
  j.salary_max, j.currency, j.deadline, j.published_at, j.closed_at,
  j.created_at, j.updated_at
FROM jobs AS j
WHERE j.id = 30;
\echo __PLAN_secondary_END__

ROLLBACK;

