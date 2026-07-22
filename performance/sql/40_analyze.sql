\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

\echo 'Updating PostgreSQL planner statistics for performance tables...'

ANALYZE users;
ANALYZE students;
ANALYZE student_profiles;
ANALYZE companies;
ANALYZE skills;
ANALYZE student_skills;
ANALYZE jobs;
ANALYZE job_skills;
ANALYZE saved_jobs;
ANALYZE cv_files;
ANALYZE applications;
ANALYZE recommendation_runs;
ANALYZE recommendation_results;
ANALYZE notifications;

\echo ''
\echo 'Planner statistics confirmation:'
SELECT
    relname AS table_name,
    last_analyze,
    n_live_tup
FROM pg_stat_all_tables
WHERE schemaname = 'public'
  AND relname IN (
      'users', 'students', 'student_profiles', 'companies', 'skills',
      'student_skills', 'jobs', 'job_skills', 'saved_jobs', 'cv_files',
      'applications', 'recommendation_runs', 'recommendation_results', 'notifications'
  )
ORDER BY relname;

\echo 'ANALYZE completed successfully.'
