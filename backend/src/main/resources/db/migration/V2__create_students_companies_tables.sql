CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    student_code VARCHAR(100),
    university VARCHAR(255),
    major VARCHAR(255),
    graduation_year INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_students_user_id UNIQUE (user_id),
    CONSTRAINT fk_students_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE student_profiles (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    headline VARCHAR(255),
    summary TEXT,
    education_level VARCHAR(100),
    gpa NUMERIC(3, 2),
    preferred_job_type VARCHAR(50),
    preferred_working_model VARCHAR(50),
    preferred_location VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_student_profiles_student_id UNIQUE (student_id),
    CONSTRAINT fk_student_profiles_student_id FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT
);

CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(100),
    website_url VARCHAR(500),
    logo_url VARCHAR(500),
    industry VARCHAR(150),
    company_size VARCHAR(100),
    description TEXT,
    address TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_companies_user_id UNIQUE (user_id),
    CONSTRAINT fk_companies_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);
