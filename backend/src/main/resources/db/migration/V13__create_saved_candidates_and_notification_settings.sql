CREATE TABLE saved_candidates (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    application_id BIGINT NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_saved_candidates_company_student UNIQUE (company_id, student_id),
    CONSTRAINT fk_saved_candidates_company_id FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
    CONSTRAINT fk_saved_candidates_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_saved_candidates_application_id FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT
);

CREATE TABLE user_notification_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    application_status_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    job_status_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    recommendation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    system_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_notification_settings_user_id UNIQUE (user_id),
    CONSTRAINT fk_user_notification_settings_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);
