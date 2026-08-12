ALTER TABLE applications
    DROP CONSTRAINT uk_applications_student_job;

CREATE UNIQUE INDEX uk_applications_student_job_active
    ON applications (student_id, job_id)
    WHERE status IN ('PENDING', 'REVIEWED', 'ACCEPTED');
