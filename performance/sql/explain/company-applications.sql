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
  a.applied_at, a.reviewed_at, a.created_at, a.updated_at,
  s.id, u.id, u.full_name, u.email,
  j.id, j.title, c.id, c.company_name,
  cv.id, cv.file_name
FROM applications AS a
JOIN jobs AS j ON j.id = a.job_id
LEFT JOIN students AS s ON s.id = a.student_id
LEFT JOIN users AS u ON u.id = s.user_id
LEFT JOIN companies AS c ON c.id = j.company_id
LEFT JOIN cv_files AS cv ON cv.id = a.cv_file_id
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
  c.id, c.user_id, c.company_name, c.status
FROM companies AS c
WHERE c.user_id = 1002;
\echo __PLAN_secondary_END__

ROLLBACK;

