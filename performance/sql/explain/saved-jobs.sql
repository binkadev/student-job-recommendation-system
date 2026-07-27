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
  saved.id, saved.student_id, saved.job_id, saved.created_at, saved.updated_at,
  job.id, job.title, job.location, job.job_type, job.working_model, job.status,
  company.id, company.company_name
FROM saved_jobs AS saved
LEFT JOIN jobs AS job ON job.id = saved.job_id
LEFT JOIN companies AS company ON company.id = job.company_id
WHERE saved.student_id = 1
ORDER BY saved.created_at DESC
OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY;
\echo __PLAN_content_END__

\echo __PLAN_count_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT count(saved.id)
FROM saved_jobs AS saved
WHERE saved.student_id = 1;
\echo __PLAN_count_END__

\echo __PLAN_secondary_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT student.id, student.user_id
FROM students AS student
WHERE student.user_id = 2;
\echo __PLAN_secondary_END__

ROLLBACK;
