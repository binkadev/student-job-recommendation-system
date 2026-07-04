CREATE TABLE recommendation_runs (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    cv_file_id BIGINT,
    source_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recommendation_runs_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_recommendation_runs_cv_file_id FOREIGN KEY (cv_file_id) REFERENCES cv_files (id) ON DELETE RESTRICT
);

CREATE TABLE recommendation_results (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL,
    job_id BIGINT NOT NULL,
    score NUMERIC(8, 5) NOT NULL,
    matched_keywords JSONB,
    rank_position INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_recommendation_results_run_job UNIQUE (run_id, job_id),
    CONSTRAINT fk_recommendation_results_run_id FOREIGN KEY (run_id) REFERENCES recommendation_runs (id) ON DELETE RESTRICT,
    CONSTRAINT fk_recommendation_results_job_id FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT
);
