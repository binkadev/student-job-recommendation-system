ALTER TABLE cv_files
    ADD COLUMN original_file_name VARCHAR(255),
    ADD COLUMN stored_file_name VARCHAR(255),
    ADD COLUMN file_path VARCHAR(500),
    ADD COLUMN processed_text TEXT,
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE cv_files
SET original_file_name = file_name
WHERE original_file_name IS NULL;

UPDATE cv_files
SET stored_file_name = file_name
WHERE stored_file_name IS NULL;

UPDATE cv_files
SET file_path = file_url
WHERE file_path IS NULL;

CREATE UNIQUE INDEX uk_cv_files_student_active
    ON cv_files (student_id)
    WHERE is_active = TRUE;
