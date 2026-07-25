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
  run.id, run.student_id, run.cv_file_id, run.source_type, run.status,
  run.started_at, run.finished_at, run.error_message, run.created_at, run.updated_at
FROM recommendation_runs AS run
WHERE run.student_id = 1
ORDER BY run.created_at DESC;
\echo __PLAN_content_END__

\echo __PLAN_count_BEGIN__
EXPLAIN (
  ANALYZE,
  BUFFERS,
  SETTINGS,
  FORMAT JSON
)
SELECT result.run_id, count(result.id)
FROM recommendation_results AS result
WHERE result.run_id IN (
  SELECT run.id
  FROM recommendation_runs AS run
  WHERE run.student_id = 1
)
GROUP BY result.run_id;
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
