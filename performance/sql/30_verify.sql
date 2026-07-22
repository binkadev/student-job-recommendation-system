\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

\echo 'Verifying deterministic performance dataset invariants...'

DO $verify$
DECLARE
    actual_count BIGINT;
    violation_count BIGINT;
    heavy_company_applications BIGINT;
    job_time_span INTERVAL;
    application_time_span INTERVAL;
BEGIN
    SELECT count(*) INTO actual_count FROM users;
    IF actual_count <> 1101 THEN RAISE EXCEPTION 'Expected 1101 users, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM students;
    IF actual_count <> 1000 THEN RAISE EXCEPTION 'Expected 1000 students, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM student_profiles;
    IF actual_count <> 1000 THEN RAISE EXCEPTION 'Expected 1000 student_profiles, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM companies;
    IF actual_count <> 100 THEN RAISE EXCEPTION 'Expected 100 companies, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM skills;
    IF actual_count <> 250 THEN RAISE EXCEPTION 'Expected 250 skills, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM student_skills;
    IF actual_count <> 8000 THEN RAISE EXCEPTION 'Expected 8000 student_skills, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM jobs;
    IF actual_count <> 10000 THEN RAISE EXCEPTION 'Expected 10000 jobs, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM job_skills;
    IF actual_count <> 50000 THEN RAISE EXCEPTION 'Expected 50000 job_skills, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM saved_jobs;
    IF actual_count <> 20000 THEN RAISE EXCEPTION 'Expected 20000 saved_jobs, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM cv_files;
    IF actual_count <> 1200 THEN RAISE EXCEPTION 'Expected 1200 cv_files, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM applications;
    IF actual_count <> 50000 THEN RAISE EXCEPTION 'Expected 50000 applications, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM recommendation_runs;
    IF actual_count <> 0 THEN RAISE EXCEPTION 'Expected 0 recommendation_runs, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM recommendation_results;
    IF actual_count <> 0 THEN RAISE EXCEPTION 'Expected 0 recommendation_results, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM notifications;
    IF actual_count <> 0 THEN RAISE EXCEPTION 'Expected 0 notifications, found %', actual_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (SELECT email FROM users GROUP BY email HAVING count(*) > 1) duplicates;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Duplicate user emails found: % groups', violation_count; END IF;

    SELECT count(*) INTO violation_count FROM skills WHERE normalized_name IS NULL;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Skills with null normalized_name found: %', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (SELECT normalized_name FROM skills GROUP BY normalized_name HAVING count(*) > 1) duplicates;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Duplicate normalized skill names found: % groups', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (SELECT student_id, skill_id FROM student_skills GROUP BY student_id, skill_id HAVING count(*) > 1) duplicates;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Duplicate student/skill pairs found: % groups', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (SELECT job_id, skill_id FROM job_skills GROUP BY job_id, skill_id HAVING count(*) > 1) duplicates;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Duplicate job/skill pairs found: % groups', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (SELECT student_id, job_id FROM saved_jobs GROUP BY student_id, job_id HAVING count(*) > 1) duplicates;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Duplicate saved student/job pairs found: % groups', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (SELECT student_id, job_id FROM applications GROUP BY student_id, job_id HAVING count(*) > 1) duplicates;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Duplicate application student/job pairs found: % groups', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (
        SELECT student.id
        FROM students student
        LEFT JOIN cv_files cv ON cv.student_id = student.id
        GROUP BY student.id
        HAVING count(cv.id) FILTER (WHERE cv.is_active = TRUE) <> 1
    ) invalid_active_cv_counts;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Students without exactly one active CV: %', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM applications application
    JOIN cv_files cv ON cv.id = application.cv_file_id
    WHERE application.cv_file_id IS NOT NULL
      AND cv.student_id <> application.student_id;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Applications referencing another student''s CV: %', violation_count; END IF;

    SELECT count(*) INTO actual_count FROM applications WHERE cv_file_id IS NOT NULL;
    IF actual_count <> 40000 THEN RAISE EXCEPTION 'Expected 40000 applications with CV metadata, found %', actual_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (
        SELECT 1 FROM students child LEFT JOIN users parent ON parent.id = child.user_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM student_profiles child LEFT JOIN students parent ON parent.id = child.student_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM companies child LEFT JOIN users parent ON parent.id = child.user_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM student_skills child LEFT JOIN students parent ON parent.id = child.student_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM student_skills child LEFT JOIN skills parent ON parent.id = child.skill_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM jobs child LEFT JOIN companies parent ON parent.id = child.company_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM job_skills child LEFT JOIN jobs parent ON parent.id = child.job_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM job_skills child LEFT JOIN skills parent ON parent.id = child.skill_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM saved_jobs child LEFT JOIN students parent ON parent.id = child.student_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM saved_jobs child LEFT JOIN jobs parent ON parent.id = child.job_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM cv_files child LEFT JOIN students parent ON parent.id = child.student_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM applications child LEFT JOIN students parent ON parent.id = child.student_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM applications child LEFT JOIN jobs parent ON parent.id = child.job_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM applications child LEFT JOIN cv_files parent ON parent.id = child.cv_file_id WHERE child.cv_file_id IS NOT NULL AND parent.id IS NULL
        UNION ALL
        SELECT 1 FROM recommendation_runs child LEFT JOIN students parent ON parent.id = child.student_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM recommendation_runs child LEFT JOIN cv_files parent ON parent.id = child.cv_file_id WHERE child.cv_file_id IS NOT NULL AND parent.id IS NULL
        UNION ALL
        SELECT 1 FROM recommendation_results child LEFT JOIN recommendation_runs parent ON parent.id = child.run_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM recommendation_results child LEFT JOIN jobs parent ON parent.id = child.job_id WHERE parent.id IS NULL
        UNION ALL
        SELECT 1 FROM notifications child LEFT JOIN users parent ON parent.id = child.user_id WHERE parent.id IS NULL
    ) invalid_foreign_keys;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Invalid foreign-key references found: %', violation_count; END IF;

    SELECT count(*) INTO actual_count FROM companies WHERE status = 'VERIFIED';
    IF actual_count <> 80 THEN RAISE EXCEPTION 'Expected 80 VERIFIED companies, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM companies WHERE status = 'PENDING';
    IF actual_count <> 10 THEN RAISE EXCEPTION 'Expected 10 PENDING companies, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM companies WHERE status = 'BLOCKED';
    IF actual_count <> 10 THEN RAISE EXCEPTION 'Expected 10 BLOCKED companies, found %', actual_count; END IF;

    SELECT count(*) INTO actual_count FROM jobs WHERE status = 'ACTIVE';
    IF actual_count <> 7000 THEN RAISE EXCEPTION 'Expected 7000 ACTIVE jobs, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM jobs WHERE status = 'DRAFT';
    IF actual_count <> 1000 THEN RAISE EXCEPTION 'Expected 1000 DRAFT jobs, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM jobs WHERE status = 'PENDING_APPROVAL';
    IF actual_count <> 500 THEN RAISE EXCEPTION 'Expected 500 PENDING_APPROVAL jobs, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM jobs WHERE status = 'CLOSED';
    IF actual_count <> 1000 THEN RAISE EXCEPTION 'Expected 1000 CLOSED jobs, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM jobs WHERE status = 'REJECTED';
    IF actual_count <> 300 THEN RAISE EXCEPTION 'Expected 300 REJECTED jobs, found %', actual_count; END IF;
    SELECT count(*) INTO actual_count FROM jobs WHERE status = 'EXPIRED';
    IF actual_count <> 200 THEN RAISE EXCEPTION 'Expected 200 EXPIRED jobs, found %', actual_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (
        SELECT student.id
        FROM students student
        LEFT JOIN student_skills item ON item.student_id = student.id
        GROUP BY student.id
        HAVING count(item.id) <> 8
    ) invalid_counts;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Students without exactly 8 skills: %', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (
        SELECT job.id
        FROM jobs job
        LEFT JOIN job_skills item ON item.job_id = job.id
        GROUP BY job.id
        HAVING count(item.id) <> 5
    ) invalid_counts;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Jobs without exactly 5 skills: %', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (
        SELECT student.id
        FROM students student
        LEFT JOIN saved_jobs item ON item.student_id = student.id
        GROUP BY student.id
        HAVING count(item.id) <> 20
    ) invalid_counts;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Students without exactly 20 saved jobs: %', violation_count; END IF;

    SELECT count(*) INTO violation_count
    FROM (
        SELECT student.id
        FROM students student
        LEFT JOIN applications item ON item.student_id = student.id
        GROUP BY student.id
        HAVING count(item.id) <> 50
    ) invalid_counts;
    IF violation_count <> 0 THEN RAISE EXCEPTION 'Students without exactly 50 applications: %', violation_count; END IF;

    SELECT count(*)
    INTO heavy_company_applications
    FROM applications application
    JOIN jobs job ON job.id = application.job_id
    WHERE job.company_id = 1;
    IF heavy_company_applications <> 5000 THEN
        RAISE EXCEPTION 'Expected 5000 heavy-company applications, found %', heavy_company_applications;
    END IF;

    SELECT max(created_at) - min(created_at) INTO job_time_span FROM jobs;
    IF job_time_span < INTERVAL '12 months' THEN RAISE EXCEPTION 'Job timestamp span is too short: %', job_time_span; END IF;

    SELECT max(applied_at) - min(applied_at) INTO application_time_span FROM applications;
    IF application_time_span < INTERVAL '12 months' THEN RAISE EXCEPTION 'Application timestamp span is too short: %', application_time_span; END IF;

    SELECT count(*) INTO actual_count
    FROM users
    WHERE (email, role, status) IN (
        ('perf.student.0001@example.test', 'STUDENT', 'ACTIVE'),
        ('perf.company.001@example.test', 'COMPANY', 'ACTIVE'),
        ('perf.admin@example.test', 'ADMIN', 'ACTIVE')
    )
      AND password_hash ~ '^\$2[aby]\$10\$'
      AND length(password_hash) = 60;
    IF actual_count <> 3 THEN RAISE EXCEPTION 'Required ACTIVE performance login accounts or BCrypt hashes are missing'; END IF;

    RAISE NOTICE 'All deterministic dataset invariants passed.';
    RAISE NOTICE 'Heavy company applications: %', heavy_company_applications;
    RAISE NOTICE 'Job timestamp span: %; application timestamp span: %', job_time_span, application_time_span;
END
$verify$;

\echo ''
\echo 'Dataset row-count summary:'
SELECT 'users' AS table_name, count(*) AS row_count FROM users
UNION ALL SELECT 'students', count(*) FROM students
UNION ALL SELECT 'student_profiles', count(*) FROM student_profiles
UNION ALL SELECT 'companies', count(*) FROM companies
UNION ALL SELECT 'skills', count(*) FROM skills
UNION ALL SELECT 'student_skills', count(*) FROM student_skills
UNION ALL SELECT 'jobs', count(*) FROM jobs
UNION ALL SELECT 'job_skills', count(*) FROM job_skills
UNION ALL SELECT 'saved_jobs', count(*) FROM saved_jobs
UNION ALL SELECT 'cv_files', count(*) FROM cv_files
UNION ALL SELECT 'applications', count(*) FROM applications
UNION ALL SELECT 'recommendation_runs', count(*) FROM recommendation_runs
UNION ALL SELECT 'recommendation_results', count(*) FROM recommendation_results
UNION ALL SELECT 'notifications', count(*) FROM notifications;

\echo ''
\echo 'Company status distribution:'
SELECT status, count(*) AS row_count FROM companies GROUP BY status ORDER BY status;

\echo ''
\echo 'Job status distribution:'
SELECT status, count(*) AS row_count FROM jobs GROUP BY status ORDER BY status;

\echo ''
\echo 'Application status distribution:'
SELECT status, count(*) AS row_count FROM applications GROUP BY status ORDER BY status;

\echo ''
SELECT
    current_database() AS database_name,
    current_user AS database_user,
    current_setting('server_version') AS postgresql_version,
    (SELECT version FROM flyway_schema_history WHERE success = TRUE AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1)
        AS latest_flyway_migration,
    (SELECT count(*) FROM applications application JOIN jobs job ON job.id = application.job_id WHERE job.company_id = 1)
        AS heavy_company_applications,
    (SELECT count(*) FROM applications WHERE cv_file_id IS NOT NULL)
        AS applications_with_cv;

\echo 'Dataset verification PASSED.'
