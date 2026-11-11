-- Additive recruiting workflows. Existing application/job history is unchanged.
CREATE TABLE interviews (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL CHECK (btrim(title) <> ''),
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
    meeting_type VARCHAR(20) NOT NULL CHECK (meeting_type IN ('ONLINE', 'ONSITE')),
    location_or_link VARCHAR(1000) NOT NULL CHECK (btrim(location_or_link) <> ''),
    notes TEXT,
    status VARCHAR(30) NOT NULL CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_interviews_company_created ON interviews(company_id, created_at DESC, id DESC);
CREATE INDEX idx_interviews_student_created ON interviews(student_id, created_at DESC, id DESC);
CREATE INDEX idx_interviews_application ON interviews(application_id);

CREATE TABLE job_invitations (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    message TEXT,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Terminal invitations are history; only one outstanding offer per target Job.
CREATE UNIQUE INDEX uk_job_invitations_pending ON job_invitations(company_id, student_id, job_id) WHERE status = 'PENDING';
CREATE INDEX idx_job_invitations_company_created ON job_invitations(company_id, created_at DESC, id DESC);
CREATE INDEX idx_job_invitations_student_created ON job_invitations(student_id, created_at DESC, id DESC);
