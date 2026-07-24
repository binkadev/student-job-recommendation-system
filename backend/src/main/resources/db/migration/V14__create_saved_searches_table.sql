CREATE TABLE saved_searches (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    keyword VARCHAR(255),
    location VARCHAR(255),
    job_type VARCHAR(50),
    working_model VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_saved_searches_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uk_saved_searches_student_name_ci
    ON saved_searches (student_id, lower(name));
