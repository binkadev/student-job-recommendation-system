CREATE TABLE cv_files (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    content_type VARCHAR(100),
    file_size BIGINT,
    extracted_text TEXT,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cv_files_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT
);

CREATE TABLE applications (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,
    cv_file_id BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    cover_letter TEXT,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_applications_student_job UNIQUE (student_id, job_id),
    CONSTRAINT fk_applications_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_job_id FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_cv_file_id FOREIGN KEY (cv_file_id) REFERENCES cv_files (id) ON DELETE RESTRICT
);
