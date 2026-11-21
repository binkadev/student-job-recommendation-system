ALTER TABLE jobs
    ADD COLUMN processed_text TEXT,
    ADD COLUMN language_code VARCHAR(20),
    ADD COLUMN language_confidence NUMERIC(5, 4),
    ADD COLUMN processing_version VARCHAR(100),
    ADD COLUMN content_hash VARCHAR(64),
    ADD COLUMN analyzed_at TIMESTAMP,
    ADD CONSTRAINT chk_jobs_language_code
        CHECK (language_code IS NULL OR language_code IN ('en', 'vi', 'mixed', 'unknown')),
    ADD CONSTRAINT chk_jobs_language_confidence
        CHECK (language_confidence IS NULL OR language_confidence BETWEEN 0 AND 1);

CREATE INDEX idx_jobs_active_deadline_id
    ON jobs (deadline, id)
    WHERE status = 'ACTIVE';

CREATE INDEX idx_jobs_fts_en_active
    ON jobs USING GIN (
        to_tsvector(
            'english',
            COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(requirements, '')
        )
    )
    WHERE status = 'ACTIVE';
