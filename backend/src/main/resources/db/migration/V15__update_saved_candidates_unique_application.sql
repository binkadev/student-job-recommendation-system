ALTER TABLE saved_candidates
    DROP CONSTRAINT IF EXISTS uk_saved_candidates_company_student;

ALTER TABLE saved_candidates
    ADD CONSTRAINT uk_saved_candidates_company_application UNIQUE (company_id, application_id);
