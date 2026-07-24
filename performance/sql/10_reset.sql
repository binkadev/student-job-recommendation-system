\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

\echo 'Resetting application data in the isolated performance database...'

BEGIN;

TRUNCATE TABLE
    notifications,
    recommendation_results,
    recommendation_runs,
    applications,
    cv_files,
    saved_jobs,
    job_skills,
    jobs,
    student_skills,
    skills,
    student_profiles,
    companies,
    students,
    users
RESTART IDENTITY CASCADE;

COMMIT;

\echo 'Application data reset completed. Flyway schema history and schema objects were preserved.'
