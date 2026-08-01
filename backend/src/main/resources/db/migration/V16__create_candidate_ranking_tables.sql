CREATE TABLE candidate_ranking_runs (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL,
    request_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    algorithm VARCHAR(100),
    algorithm_version VARCHAR(100),
    threshold NUMERIC(8, 5) NOT NULL,
    requested_limit INTEGER NOT NULL,
    total_applications_scanned INTEGER NOT NULL DEFAULT 0,
    eligible_candidates INTEGER NOT NULL DEFAULT 0,
    skipped_no_cv INTEGER NOT NULL DEFAULT 0,
    skipped_not_ready INTEGER NOT NULL DEFAULT 0,
    skipped_terminal_status INTEGER NOT NULL DEFAULT 0,
    input_fingerprint VARCHAR(64) NOT NULL,
    job_updated_at_snapshot TIMESTAMP NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_candidate_ranking_runs_request_id UNIQUE (request_id),
    CONSTRAINT fk_candidate_ranking_runs_job_id
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT,
    CONSTRAINT chk_candidate_ranking_runs_status
        CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED')),
    CONSTRAINT chk_candidate_ranking_runs_threshold
        CHECK (threshold BETWEEN 0 AND 1),
    CONSTRAINT chk_candidate_ranking_runs_requested_limit
        CHECK (requested_limit BETWEEN 1 AND 100),
    CONSTRAINT chk_candidate_ranking_runs_counters_nonnegative
        CHECK (
            total_applications_scanned >= 0
            AND eligible_candidates >= 0
            AND skipped_no_cv >= 0
            AND skipped_not_ready >= 0
            AND skipped_terminal_status >= 0
        ),
    CONSTRAINT chk_candidate_ranking_runs_counter_consistency
        CHECK (
            total_applications_scanned = eligible_candidates
                + skipped_no_cv
                + skipped_not_ready
                + skipped_terminal_status
        ),
    CONSTRAINT chk_candidate_ranking_runs_input_fingerprint
        CHECK (char_length(input_fingerprint) = 64)
);

CREATE UNIQUE INDEX uk_candidate_ranking_runs_job_processing
    ON candidate_ranking_runs (job_id)
    WHERE status = 'PROCESSING';

CREATE INDEX idx_candidate_ranking_runs_job_status_created_at
    ON candidate_ranking_runs (job_id, status, created_at DESC, id DESC);

CREATE TABLE candidate_ranking_results (
    id BIGSERIAL PRIMARY KEY,
    run_id BIGINT NOT NULL,
    application_id BIGINT NOT NULL,
    cv_file_id BIGINT NOT NULL,
    score NUMERIC(8, 5) NOT NULL,
    text_score NUMERIC(8, 5),
    skill_score NUMERIC(8, 5) NOT NULL,
    scoring_strategy VARCHAR(50) NOT NULL,
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    reason TEXT,
    rank_position INTEGER NOT NULL,
    cv_processing_version VARCHAR(100),
    cv_analyzed_at_snapshot TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_candidate_ranking_results_run_application UNIQUE (run_id, application_id),
    CONSTRAINT uk_candidate_ranking_results_run_rank UNIQUE (run_id, rank_position),
    CONSTRAINT fk_candidate_ranking_results_run_id
        FOREIGN KEY (run_id) REFERENCES candidate_ranking_runs (id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_ranking_results_application_id
        FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_candidate_ranking_results_cv_file_id
        FOREIGN KEY (cv_file_id) REFERENCES cv_files (id) ON DELETE RESTRICT,
    CONSTRAINT chk_candidate_ranking_results_score
        CHECK (score BETWEEN 0 AND 1),
    CONSTRAINT chk_candidate_ranking_results_text_score
        CHECK (text_score IS NULL OR text_score BETWEEN 0 AND 1),
    CONSTRAINT chk_candidate_ranking_results_skill_score
        CHECK (skill_score BETWEEN 0 AND 1),
    CONSTRAINT chk_candidate_ranking_results_rank_position
        CHECK (rank_position > 0),
    CONSTRAINT chk_candidate_ranking_results_scoring_strategy
        CHECK (scoring_strategy IN ('SAME_LANGUAGE_HYBRID', 'CROSS_LANGUAGE_SKILL_BASED')),
    CONSTRAINT chk_candidate_ranking_results_strategy_text_score
        CHECK (
            (scoring_strategy = 'SAME_LANGUAGE_HYBRID' AND text_score IS NOT NULL)
            OR (scoring_strategy = 'CROSS_LANGUAGE_SKILL_BASED' AND text_score IS NULL)
        ),
    CONSTRAINT chk_candidate_ranking_results_matched_skills_array
        CHECK (jsonb_typeof(matched_skills) = 'array'),
    CONSTRAINT chk_candidate_ranking_results_missing_skills_array
        CHECK (jsonb_typeof(missing_skills) = 'array')
);
