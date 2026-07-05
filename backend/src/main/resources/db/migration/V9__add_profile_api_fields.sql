ALTER TABLE students
    ADD COLUMN location VARCHAR(255);

ALTER TABLE student_profiles
    ADD COLUMN education TEXT,
    ADD COLUMN experience TEXT,
    ADD COLUMN projects TEXT,
    ADD COLUMN target_position VARCHAR(255),
    ADD COLUMN raw_text TEXT,
    ADD COLUMN processed_text TEXT,
    ADD COLUMN profile_completeness INTEGER NOT NULL DEFAULT 0;

ALTER TABLE companies
    ADD COLUMN phone VARCHAR(50);
