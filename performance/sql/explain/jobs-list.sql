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
  j.id, j.company_id, j.title, j.description, j.requirements, j.benefits,
  j.location, j.job_type, j.working_model, j.status, j.salary_min,
  j.salary_max, j.currency, j.deadline, j.published_at, j.closed_at,
  j.created_at, j.updated_at
FROM jobs AS j
WHERE j.status = 'ACTIVE'
ORDER BY j.created_at DESC
OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY;
\echo __PLAN_content_END__

\echo __PLAN_count_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT count(j.id)
FROM jobs AS j
WHERE j.status = 'ACTIVE';
\echo __PLAN_count_END__

\echo __PLAN_secondary_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT
  js.id, js.job_id, js.skill_id, js.importance, js.min_level,
  js.created_at, js.updated_at
FROM job_skills AS js
JOIN jobs AS j ON j.id = js.job_id
WHERE j.id = 540
ORDER BY js.id;
\echo __PLAN_secondary_END__

ROLLBACK;
