-- Additive student profile extension columns; existing rows and columns remain unchanged.
ALTER TABLE student_profiles
    ADD COLUMN github_url VARCHAR(500),
    ADD COLUMN linkedin_url VARCHAR(500),
    ADD COLUMN portfolio_url VARCHAR(500),
    ADD COLUMN certificates_json TEXT,
    ADD COLUMN languages_json TEXT;
