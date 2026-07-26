ALTER TABLE cv_files
    ADD COLUMN extracted_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN analysis_status VARCHAR(30),
    ADD COLUMN analysis_error TEXT,
    ADD COLUMN language_code VARCHAR(20),
    ADD COLUMN language_confidence NUMERIC(5, 4),
    ADD COLUMN processing_version VARCHAR(100),
    ADD COLUMN analysis_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN analyzed_at TIMESTAMP;

UPDATE cv_files
SET analysis_status = CASE
    WHEN extracted_text IS NOT NULL
     AND BTRIM(extracted_text) <> ''
     AND processed_text IS NOT NULL
     AND BTRIM(processed_text) <> ''
    THEN 'READY'
    ELSE 'NOT_READY'
END;

ALTER TABLE cv_files
    ALTER COLUMN analysis_status SET DEFAULT 'NOT_READY',
    ALTER COLUMN analysis_status SET NOT NULL,
    ADD CONSTRAINT chk_cv_files_analysis_status
        CHECK (analysis_status IN ('NOT_READY', 'PROCESSING', 'READY', 'FAILED')),
    ADD CONSTRAINT chk_cv_files_language_code
        CHECK (language_code IS NULL OR language_code IN ('en', 'vi', 'mixed', 'unknown')),
    ADD CONSTRAINT chk_cv_files_language_confidence
        CHECK (language_confidence IS NULL OR language_confidence BETWEEN 0 AND 1);

ALTER TABLE recommendation_runs
    ADD COLUMN algorithm VARCHAR(100),
    ADD COLUMN algorithm_version VARCHAR(100),
    ADD COLUMN total_jobs_scanned INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_recommendation_runs_total_jobs_scanned
        CHECK (total_jobs_scanned >= 0);

ALTER TABLE recommendation_results
    ADD COLUMN text_score NUMERIC(8, 5),
    ADD COLUMN skill_score NUMERIC(8, 5),
    ADD COLUMN scoring_strategy VARCHAR(50),
    ADD COLUMN missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN reason TEXT,
    ADD CONSTRAINT chk_recommendation_results_score
        CHECK (score BETWEEN 0 AND 1),
    ADD CONSTRAINT chk_recommendation_results_text_score
        CHECK (text_score IS NULL OR text_score BETWEEN 0 AND 1),
    ADD CONSTRAINT chk_recommendation_results_skill_score
        CHECK (skill_score IS NULL OR skill_score BETWEEN 0 AND 1),
    ADD CONSTRAINT chk_recommendation_results_scoring_strategy
        CHECK (
            scoring_strategy IS NULL
            OR scoring_strategy IN ('SAME_LANGUAGE_HYBRID', 'CROSS_LANGUAGE_SKILL_BASED')
        );

CREATE INDEX idx_recommendation_runs_student_status_created_at
    ON recommendation_runs (student_id, status, created_at DESC, id DESC);
