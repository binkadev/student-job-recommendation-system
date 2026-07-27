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
  j.created_at, j.updated_at,
  c.id, c.company_name, c.status
FROM jobs AS j
LEFT JOIN companies AS c ON c.id = j.company_id
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
  js.created_at, js.updated_at,
  s.id, s.name, s.normalized_name, s.category
FROM job_skills AS js
JOIN skills AS s ON s.id = js.skill_id
WHERE js.job_id IN (
  SELECT page.id
  FROM jobs AS page
  WHERE page.status = 'ACTIVE'
  ORDER BY page.created_at DESC
  OFFSET 0 ROWS FETCH FIRST 20 ROWS ONLY
)
ORDER BY js.job_id, js.id;
\echo __PLAN_secondary_END__

ROLLBACK;
