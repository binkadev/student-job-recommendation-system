CREATE TABLE skills (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_skills_name UNIQUE (name)
);

CREATE TABLE student_skills (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    level VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    years_of_experience NUMERIC(4, 1),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_student_skills_student_skill UNIQUE (student_id, skill_id),
    CONSTRAINT fk_student_skills_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_skills_skill_id FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE RESTRICT
);
