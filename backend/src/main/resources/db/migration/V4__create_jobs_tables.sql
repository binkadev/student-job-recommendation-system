CREATE TABLE jobs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    benefits TEXT,
    location VARCHAR(255),
    job_type VARCHAR(50) NOT NULL,
    working_model VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    salary_min NUMERIC(14, 2),
    salary_max NUMERIC(14, 2),
    currency VARCHAR(10),
    deadline DATE,
    published_at TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_jobs_company_id FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT
);

CREATE TABLE job_skills (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    importance VARCHAR(50) NOT NULL,
    min_level VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_job_skills_job_skill UNIQUE (job_id, skill_id),
    CONSTRAINT fk_job_skills_job_id FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT,
    CONSTRAINT fk_job_skills_skill_id FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE RESTRICT
);

CREATE TABLE saved_jobs (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_saved_jobs_student_job UNIQUE (student_id, job_id),
    CONSTRAINT fk_saved_jobs_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_saved_jobs_job_id FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT
);
