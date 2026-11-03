-- Aggregate revision only; all existing profile/CV/skill data remains unchanged.
ALTER TABLE students ADD COLUMN profile_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE students ADD CONSTRAINT ck_students_profile_revision CHECK (profile_revision >= 0);
