ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(150);

UPDATE skills
SET normalized_name = lower(trim(regexp_replace(name, '[[:space:]]+', ' ', 'g')))
WHERE normalized_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_skills_normalized_name
    ON skills (normalized_name)
    WHERE normalized_name IS NOT NULL;
