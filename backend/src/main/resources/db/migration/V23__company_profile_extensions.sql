-- Additive company profile extensions; existing rows retain nullable defaults.
-- verification_document_url is reserved schema only; no submission or public API exposure.
ALTER TABLE companies
    ADD COLUMN cover_image_url VARCHAR(500),
    ADD COLUMN verification_document_url VARCHAR(500);
