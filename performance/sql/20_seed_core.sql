\set ON_ERROR_STOP on
\ir /performance/sql/00_guard.sql

\echo 'Seeding deterministic core performance dataset...'

BEGIN;

DO $empty_check$
DECLARE
    existing_rows BIGINT;
BEGIN
    SELECT
        (SELECT count(*) FROM users)
        + (SELECT count(*) FROM students)
        + (SELECT count(*) FROM student_profiles)
        + (SELECT count(*) FROM companies)
        + (SELECT count(*) FROM skills)
        + (SELECT count(*) FROM student_skills)
        + (SELECT count(*) FROM jobs)
        + (SELECT count(*) FROM job_skills)
        + (SELECT count(*) FROM saved_jobs)
        + (SELECT count(*) FROM cv_files)
        + (SELECT count(*) FROM applications)
        + (SELECT count(*) FROM recommendation_runs)
        + (SELECT count(*) FROM recommendation_results)
        + (SELECT count(*) FROM notifications)
    INTO existing_rows;

    IF existing_rows <> 0 THEN
        RAISE EXCEPTION
            'Seed aborted: expected empty application tables, found % rows. Run 10_reset.sql first.',
            existing_rows;
    END IF;
END
$empty_check$;

-- All local performance users share the documented non-production password:
-- PerfLocalOnly2026
-- BCrypt generated with Spring Security BCryptPasswordEncoder strength 10.
INSERT INTO users (
    id, email, password_hash, full_name, phone, role, status,
    created_at, updated_at, last_login_at
)
VALUES (
    1,
    'perf.admin@example.test',
    '$2a$10$81x4XtpM4s/zX3hv8w33KebFaGBv1pD2mdihaY9Ai.ileVDHGap.K',
    'Performance Admin',
    '0900000001',
    'ADMIN',
    'ACTIVE',
    TIMESTAMP '2025-01-01 08:00:00',
    TIMESTAMP '2025-01-01 08:00:00',
    NULL
);

INSERT INTO users (
    id, email, password_hash, full_name, phone, role, status,
    created_at, updated_at, last_login_at
)
SELECT
    student_number + 1,
    format('perf.student.%s@example.test', lpad(student_number::TEXT, 4, '0')),
    '$2a$10$81x4XtpM4s/zX3hv8w33KebFaGBv1pD2mdihaY9Ai.ileVDHGap.K',
    format('Performance Student %s', lpad(student_number::TEXT, 4, '0')),
    format('091%s', lpad(student_number::TEXT, 7, '0')),
    'STUDENT',
    'ACTIVE',
    TIMESTAMP '2025-01-01 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    TIMESTAMP '2025-01-01 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    NULL
FROM generate_series(1, 1000) AS series(student_number);

INSERT INTO users (
    id, email, password_hash, full_name, phone, role, status,
    created_at, updated_at, last_login_at
)
SELECT
    company_number + 1001,
    format('perf.company.%s@example.test', lpad(company_number::TEXT, 3, '0')),
    '$2a$10$81x4XtpM4s/zX3hv8w33KebFaGBv1pD2mdihaY9Ai.ileVDHGap.K',
    format('Performance Company User %s', lpad(company_number::TEXT, 3, '0')),
    format('092%s', lpad(company_number::TEXT, 7, '0')),
    'COMPANY',
    'ACTIVE',
    TIMESTAMP '2025-01-01 08:00:00' + ((company_number - 1) % 100) * INTERVAL '1 day',
    TIMESTAMP '2025-01-01 08:00:00' + ((company_number - 1) % 100) * INTERVAL '1 day',
    NULL
FROM generate_series(1, 100) AS series(company_number);

INSERT INTO students (
    id, user_id, student_code, university, major, graduation_year,
    created_at, updated_at, location
)
SELECT
    student_number,
    student_number + 1,
    format('PERF-STU-%s', lpad(student_number::TEXT, 4, '0')),
    (ARRAY[
        'Ho Chi Minh City University of Technology',
        'University of Information Technology',
        'FPT University',
        'University of Science',
        'Can Tho University'
    ])[1 + ((student_number - 1) % 5)],
    (ARRAY[
        'Software Engineering',
        'Computer Science',
        'Information Systems',
        'Data Science'
    ])[1 + ((student_number - 1) % 4)],
    2025 + ((student_number - 1) % 4),
    TIMESTAMP '2025-01-02 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    TIMESTAMP '2025-01-02 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    (ARRAY[
        'Ho Chi Minh City', 'Ha Noi', 'Da Nang', 'Can Tho', 'Hai Phong'
    ])[1 + ((student_number - 1) % 5)]
FROM generate_series(1, 1000) AS series(student_number);

INSERT INTO student_profiles (
    id, student_id, headline, summary, education_level, gpa,
    preferred_job_type, preferred_working_model, preferred_location,
    created_at, updated_at, education, experience, projects,
    target_position, raw_text, processed_text, profile_completeness
)
SELECT
    student_number,
    student_number,
    format('%s candidate seeking an IT student role',
        (ARRAY['Backend Developer', 'Frontend Developer', 'Data Engineer', 'QA Engineer'])
        [1 + ((student_number - 1) % 4)]),
    'IT student with academic projects, team collaboration, Git, SQL, REST API, and software delivery experience.',
    'BACHELOR',
    2.50 + ((student_number - 1) % 151)::NUMERIC / 100,
    (ARRAY['INTERNSHIP', 'PART_TIME', 'FULL_TIME', 'CONTRACT'])
        [1 + ((student_number - 1) % 4)],
    (ARRAY['ONSITE', 'HYBRID', 'REMOTE'])
        [1 + ((student_number - 1) % 3)],
    (ARRAY['Ho Chi Minh City', 'Ha Noi', 'Da Nang', 'Can Tho', 'Hai Phong'])
        [1 + ((student_number - 1) % 5)],
    TIMESTAMP '2025-01-03 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    TIMESTAMP '2025-01-03 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    'Bachelor program in an information technology discipline.',
    'Coursework and team projects using Java, JavaScript, SQL, testing, and cloud tooling.',
    'Student job recommendation system, REST API service, and responsive web application.',
    (ARRAY['Backend Developer Intern', 'Frontend Developer Intern', 'Data Intern', 'QA Intern'])
        [1 + ((student_number - 1) % 4)],
    'java spring boot postgresql rest api javascript testing docker git teamwork',
    'java spring boot postgresql rest api javascript testing docker git teamwork',
    70 + ((student_number - 1) % 31)
FROM generate_series(1, 1000) AS series(student_number);

INSERT INTO companies (
    id, user_id, company_name, tax_code, website_url, logo_url,
    industry, company_size, description, address, status,
    created_at, updated_at, phone
)
SELECT
    company_number,
    company_number + 1001,
    CASE
        WHEN company_number = 1 THEN 'Performance Heavy Company'
        ELSE format('Performance Technology Company %s', lpad(company_number::TEXT, 3, '0'))
    END,
    format('PERF-TAX-%s', lpad(company_number::TEXT, 5, '0')),
    format('https://company-%s.example.test', lpad(company_number::TEXT, 3, '0')),
    format('https://assets.example.test/company-%s.png', lpad(company_number::TEXT, 3, '0')),
    (ARRAY[
        'Software Development', 'Financial Technology', 'E-commerce',
        'Cloud Services', 'Data Analytics'
    ])[1 + ((company_number - 1) % 5)],
    (ARRAY['1-50', '51-200', '201-500', '501-1000'])
        [1 + ((company_number - 1) % 4)],
    'Technology employer offering internships and junior roles with mentorship, code review, agile delivery, and real customer projects.',
    format('%s, %s',
        10 + company_number,
        (ARRAY['Ho Chi Minh City', 'Ha Noi', 'Da Nang', 'Can Tho', 'Hai Phong'])
        [1 + ((company_number - 1) % 5)]),
    CASE
        WHEN company_number <= 80 THEN 'VERIFIED'
        WHEN company_number <= 90 THEN 'PENDING'
        ELSE 'BLOCKED'
    END,
    TIMESTAMP '2025-01-05 08:00:00' + (company_number - 1) * INTERVAL '1 day',
    TIMESTAMP '2025-01-05 08:00:00' + (company_number - 1) * INTERVAL '1 day',
    format('093%s', lpad(company_number::TEXT, 7, '0'))
FROM generate_series(1, 100) AS series(company_number);

INSERT INTO skills (
    id, name, category, description, created_at, updated_at, normalized_name
)
SELECT
    skill_number,
    format('%s %s',
        (ARRAY[
            'Java', 'Spring Boot', 'PostgreSQL', 'REST API', 'Git',
            'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue',
            'Python', 'Django', 'FastAPI', 'Docker', 'Kubernetes',
            'AWS', 'Azure', 'Linux', 'JUnit', 'Selenium',
            'SQL', 'Data Analysis', 'Machine Learning', 'Figma', 'Agile'
        ])[1 + ((skill_number - 1) % 25)],
        lpad(skill_number::TEXT, 3, '0')),
    (ARRAY['Backend', 'Frontend', 'Database', 'DevOps', 'Cloud', 'Testing', 'Data', 'Tool'])
        [1 + ((skill_number - 1) % 8)],
    'Deterministic performance skill used for student and job matching metadata.',
    TIMESTAMP '2025-01-06 08:00:00' + ((skill_number - 1) % 30) * INTERVAL '1 day',
    TIMESTAMP '2025-01-06 08:00:00' + ((skill_number - 1) % 30) * INTERVAL '1 day',
    lower(format('%s %s',
        (ARRAY[
            'Java', 'Spring Boot', 'PostgreSQL', 'REST API', 'Git',
            'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue',
            'Python', 'Django', 'FastAPI', 'Docker', 'Kubernetes',
            'AWS', 'Azure', 'Linux', 'JUnit', 'Selenium',
            'SQL', 'Data Analysis', 'Machine Learning', 'Figma', 'Agile'
        ])[1 + ((skill_number - 1) % 25)],
        lpad(skill_number::TEXT, 3, '0')))
FROM generate_series(1, 250) AS series(skill_number);

INSERT INTO student_skills (
    id, student_id, skill_id, level, source, years_of_experience,
    created_at, updated_at
)
SELECT
    (student_number - 1) * 8 + skill_slot,
    student_number,
    1 + (((student_number - 1) * 8 + skill_slot - 1) % 250),
    (ARRAY['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])[1 + ((skill_slot - 1) % 3)],
    (ARRAY['MANUAL', 'CV_EXTRACTED', 'ADMIN_SEEDED'])[1 + ((student_number + skill_slot) % 3)],
    ((student_number + skill_slot) % 41)::NUMERIC / 10,
    TIMESTAMP '2025-02-01 08:00:00' + ((student_number + skill_slot) % 365) * INTERVAL '1 day',
    TIMESTAMP '2025-02-01 08:00:00' + ((student_number + skill_slot) % 365) * INTERVAL '1 day'
FROM generate_series(1, 1000) AS students(student_number)
CROSS JOIN generate_series(1, 8) AS slots(skill_slot);

WITH job_source AS (
    SELECT
        (company_number - 1) * 100 + job_number AS job_id,
        company_number,
        job_number,
        TIMESTAMP '2025-01-01 09:00:00'
            + (((company_number - 1) * 100 + job_number - 1) % 540) * INTERVAL '1 day'
            AS created_timestamp,
        CASE
            WHEN job_number <= 70 THEN 'ACTIVE'
            WHEN job_number <= 80 THEN 'DRAFT'
            WHEN job_number <= 85 THEN 'PENDING_APPROVAL'
            WHEN job_number <= 95 THEN 'CLOSED'
            WHEN job_number <= 98 THEN 'REJECTED'
            ELSE 'EXPIRED'
        END AS job_status
    FROM generate_series(1, 100) AS companies(company_number)
    CROSS JOIN generate_series(1, 100) AS jobs(job_number)
)
INSERT INTO jobs (
    id, company_id, title, description, requirements, benefits, location,
    job_type, working_model, status, salary_min, salary_max, currency,
    deadline, published_at, closed_at, created_at, updated_at
)
SELECT
    job_id,
    company_number,
    format('%s %s',
        (ARRAY[
            'Backend Developer Intern', 'Frontend Developer Intern',
            'Java Developer', 'Software Engineer Intern', 'QA Engineer Intern',
            'Data Analyst Intern', 'Cloud Engineer Intern', 'DevOps Intern',
            'Mobile Developer Intern', 'Full Stack Developer Intern'
        ])[1 + ((job_id - 1) % 10)],
        lpad(job_id::TEXT, 5, '0')),
    format('Company %s is hiring an IT student to deliver production-quality software with mentoring, code review, testing, documentation, and agile teamwork.', company_number),
    format('Required skills include %s, SQL, Git, REST APIs, testing fundamentals, communication, and willingness to learn.',
        (ARRAY['Java and Spring Boot', 'JavaScript and React', 'Python and data analysis', 'Docker and Linux'])
        [1 + ((job_id - 1) % 4)]),
    'Mentorship, code review, internship allowance, flexible working arrangements, technical workshops, and real project experience.',
    (ARRAY[
        'Ho Chi Minh City', 'Ha Noi', 'Da Nang', 'Can Tho', 'Hai Phong',
        'Binh Duong', 'Dong Nai', 'Hue', 'Nha Trang', 'Remote - Viet Nam'
    ])[1 + ((job_id - 1) % 10)],
    (ARRAY['INTERNSHIP', 'PART_TIME', 'FULL_TIME', 'CONTRACT'])
        [1 + ((job_id - 1) % 4)],
    (ARRAY['ONSITE', 'HYBRID', 'REMOTE'])
        [1 + ((job_id - 1) % 3)],
    job_status,
    3000000 + ((job_id - 1) % 8) * 500000,
    6000000 + ((job_id - 1) % 8) * 750000,
    'VND',
    created_timestamp::DATE + 730 + ((job_id - 1) % 60),
    CASE
        WHEN job_status IN ('ACTIVE', 'CLOSED', 'EXPIRED') THEN created_timestamp + INTERVAL '2 days'
        ELSE NULL
    END,
    CASE
        WHEN job_status IN ('CLOSED', 'EXPIRED') THEN created_timestamp + INTERVAL '90 days'
        ELSE NULL
    END,
    created_timestamp,
    created_timestamp + INTERVAL '7 days'
FROM job_source;

INSERT INTO job_skills (
    id, job_id, skill_id, importance, min_level, created_at, updated_at
)
SELECT
    (job_id - 1) * 5 + skill_slot,
    job_id,
    1 + (((job_id - 1) * 5 + skill_slot - 1) % 250),
    CASE
        WHEN skill_slot <= 3 THEN 'REQUIRED'
        WHEN skill_slot = 4 THEN 'PREFERRED'
        ELSE 'NICE_TO_HAVE'
    END,
    (ARRAY['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])[1 + ((job_id + skill_slot) % 3)],
    TIMESTAMP '2025-01-03 09:00:00' + ((job_id - 1) % 540) * INTERVAL '1 day',
    TIMESTAMP '2025-01-03 09:00:00' + ((job_id - 1) % 540) * INTERVAL '1 day'
FROM generate_series(1, 10000) AS jobs(job_id)
CROSS JOIN generate_series(1, 5) AS slots(skill_slot);

INSERT INTO saved_jobs (
    id, student_id, job_id, created_at, updated_at
)
SELECT
    (student_number - 1) * 20 + saved_slot,
    student_number,
    1 + (((student_number - 1) * 37 + (saved_slot - 1) * 101) % 10000),
    TIMESTAMP '2025-03-01 10:00:00'
        + (((student_number - 1) * 20 + saved_slot - 1) % 500) * INTERVAL '1 day',
    TIMESTAMP '2025-03-01 10:00:00'
        + (((student_number - 1) * 20 + saved_slot - 1) % 500) * INTERVAL '1 day'
FROM generate_series(1, 1000) AS students(student_number)
CROSS JOIN generate_series(1, 20) AS slots(saved_slot);

INSERT INTO cv_files (
    id, student_id, file_name, file_url, content_type, file_size,
    extracted_text, uploaded_at, created_at, updated_at,
    original_file_name, stored_file_name, file_path, processed_text, is_active
)
SELECT
    student_number,
    student_number,
    format('student-%s-active-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    format('performance/cvs/student-%s-active-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    'application/pdf',
    120000 + (student_number % 300) * 1000,
    'java spring boot postgresql rest api git teamwork student project internship',
    TIMESTAMP '2025-06-01 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    TIMESTAMP '2025-06-01 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    TIMESTAMP '2025-06-01 08:00:00' + ((student_number - 1) % 365) * INTERVAL '1 day',
    format('student-%s-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    format('student-%s-active-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    format('performance/cvs/student-%s-active-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    'java spring boot postgresql rest api git teamwork student project internship',
    TRUE
FROM generate_series(1, 1000) AS students(student_number);

INSERT INTO cv_files (
    id, student_id, file_name, file_url, content_type, file_size,
    extracted_text, uploaded_at, created_at, updated_at,
    original_file_name, stored_file_name, file_path, processed_text, is_active
)
SELECT
    1000 + student_number,
    student_number,
    format('student-%s-historical-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    format('performance/cvs/student-%s-historical-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    'application/pdf',
    90000 + (student_number % 100) * 1000,
    'historical student cv metadata for deterministic local performance testing',
    TIMESTAMP '2024-06-01 08:00:00' + (student_number - 1) * INTERVAL '1 day',
    TIMESTAMP '2024-06-01 08:00:00' + (student_number - 1) * INTERVAL '1 day',
    TIMESTAMP '2024-06-01 08:00:00' + (student_number - 1) * INTERVAL '1 day',
    format('student-%s-historical-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    format('student-%s-historical-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    format('performance/cvs/student-%s-historical-cv.pdf', lpad(student_number::TEXT, 4, '0')),
    'historical student cv metadata for deterministic local performance testing',
    FALSE
FROM generate_series(1, 200) AS students(student_number);

WITH application_slots AS (
    SELECT
        student_number,
        application_slot,
        (student_number - 1) * 50 + application_slot AS application_id,
        (student_number - 1) * 45 + (application_slot - 6) AS regular_pool_index
    FROM generate_series(1, 1000) AS students(student_number)
    CROSS JOIN generate_series(1, 50) AS slots(application_slot)
),
application_source AS (
    SELECT
        student_number,
        application_slot,
        application_id,
        CASE
            WHEN application_slot <= 5 THEN
                1 + (((student_number - 1) * 5 + application_slot - 1) % 70)
            ELSE
                ((2 + (regular_pool_index % 99)) - 1) * 100
                + 1 + ((regular_pool_index / 99) % 70)
        END AS job_id,
        CASE
            WHEN application_id % 20 BETWEEN 0 AND 9 THEN 'PENDING'
            WHEN application_id % 20 BETWEEN 10 AND 13 THEN 'REVIEWED'
            WHEN application_id % 20 BETWEEN 14 AND 16 THEN 'ACCEPTED'
            WHEN application_id % 20 BETWEEN 17 AND 18 THEN 'REJECTED'
            ELSE 'WITHDRAWN'
        END AS application_status,
        TIMESTAMP '2025-01-01 10:00:00'
            + ((application_id - 1) % 540) * INTERVAL '1 day'
            + ((application_id - 1) % 480) * INTERVAL '1 minute'
            AS applied_timestamp
    FROM application_slots
)
INSERT INTO applications (
    id, student_id, job_id, cv_file_id, status, cover_letter,
    applied_at, reviewed_at, created_at, updated_at
)
SELECT
    application_id,
    student_number,
    job_id,
    CASE WHEN application_slot % 5 <> 0 THEN student_number ELSE NULL END,
    application_status,
    repeat(
        format('I am student %s applying for job %s. My coursework and projects use Java, SQL, REST APIs, Git, testing, and collaborative software delivery. ', student_number, job_id),
        CASE
            WHEN application_id % 10 = 0 THEN 8
            WHEN application_id % 3 = 0 THEN 4
            ELSE 2
        END
    ),
    applied_timestamp,
    CASE
        WHEN application_status IN ('REVIEWED', 'ACCEPTED', 'REJECTED')
            THEN applied_timestamp + INTERVAL '5 days'
        ELSE NULL
    END,
    applied_timestamp,
    CASE
        WHEN application_status IN ('REVIEWED', 'ACCEPTED', 'REJECTED')
            THEN applied_timestamp + INTERVAL '5 days'
        ELSE applied_timestamp
    END
FROM application_source;

SELECT setval(pg_get_serial_sequence('public.users', 'id'), 1101, TRUE);
SELECT setval(pg_get_serial_sequence('public.students', 'id'), 1000, TRUE);
SELECT setval(pg_get_serial_sequence('public.student_profiles', 'id'), 1000, TRUE);
SELECT setval(pg_get_serial_sequence('public.companies', 'id'), 100, TRUE);
SELECT setval(pg_get_serial_sequence('public.skills', 'id'), 250, TRUE);
SELECT setval(pg_get_serial_sequence('public.student_skills', 'id'), 8000, TRUE);
SELECT setval(pg_get_serial_sequence('public.jobs', 'id'), 10000, TRUE);
SELECT setval(pg_get_serial_sequence('public.job_skills', 'id'), 50000, TRUE);
SELECT setval(pg_get_serial_sequence('public.saved_jobs', 'id'), 20000, TRUE);
SELECT setval(pg_get_serial_sequence('public.cv_files', 'id'), 1200, TRUE);
SELECT setval(pg_get_serial_sequence('public.applications', 'id'), 50000, TRUE);

COMMIT;

\echo 'Deterministic core dataset seed completed.'
