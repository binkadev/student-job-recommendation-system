\set ON_ERROR_STOP on

\echo 'Checking performance database safety guard...'

DO $guard$
DECLARE
    latest_version TEXT;
    missing_tables TEXT[];
BEGIN
    IF current_database() IS DISTINCT FROM 'student_job_recommendation_perf' THEN
        RAISE EXCEPTION
            'SAFETY GUARD FAILED: expected database student_job_recommendation_perf, connected to %',
            current_database();
    END IF;

    IF current_user IS DISTINCT FROM 'perf_user' THEN
        RAISE EXCEPTION
            'SAFETY GUARD FAILED: expected user perf_user, connected as %',
            current_user;
    END IF;

    IF to_regclass('public.flyway_schema_history') IS NULL THEN
        RAISE EXCEPTION
            'SAFETY GUARD FAILED: public.flyway_schema_history does not exist; start the backend so Flyway V1-V12 can run';
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE success = FALSE) THEN
        RAISE EXCEPTION
            'SAFETY GUARD FAILED: flyway_schema_history contains a failed migration';
    END IF;

    SELECT version
    INTO latest_version
    FROM public.flyway_schema_history
    WHERE success = TRUE
      AND version IS NOT NULL
    ORDER BY installed_rank DESC
    LIMIT 1;

    IF latest_version IS DISTINCT FROM '12' THEN
        RAISE EXCEPTION
            'SAFETY GUARD FAILED: expected latest Flyway migration 12, found %',
            COALESCE(latest_version, '<none>');
    END IF;

    SELECT array_agg(required_table ORDER BY required_table)
    INTO missing_tables
    FROM (VALUES
        ('users'),
        ('students'),
        ('student_profiles'),
        ('companies'),
        ('skills'),
        ('student_skills'),
        ('jobs'),
        ('job_skills'),
        ('saved_jobs'),
        ('cv_files'),
        ('applications'),
        ('recommendation_runs'),
        ('recommendation_results'),
        ('notifications')
    ) AS required(required_table)
    WHERE to_regclass(format('public.%I', required_table)) IS NULL;

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION
            'SAFETY GUARD FAILED: required application tables are missing: %',
            array_to_string(missing_tables, ', ');
    END IF;

    RAISE NOTICE
        'Safety guard passed: database=%, user=%, latest_flyway=%',
        current_database(), current_user, latest_version;
END
$guard$;

\echo 'Performance database safety guard PASSED.'
