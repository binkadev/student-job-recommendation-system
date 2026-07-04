CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_status ON users (status);

CREATE INDEX idx_companies_status ON companies (status);
CREATE INDEX idx_companies_company_name ON companies (company_name);

CREATE INDEX idx_skills_category ON skills (category);

CREATE INDEX idx_student_skills_skill_id ON student_skills (skill_id);

CREATE INDEX idx_jobs_company_id ON jobs (company_id);
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_job_type ON jobs (job_type);
CREATE INDEX idx_jobs_working_model ON jobs (working_model);
CREATE INDEX idx_jobs_deadline ON jobs (deadline);

CREATE INDEX idx_job_skills_skill_id ON job_skills (skill_id);

CREATE INDEX idx_saved_jobs_job_id ON saved_jobs (job_id);

CREATE INDEX idx_cv_files_student_id ON cv_files (student_id);

CREATE INDEX idx_applications_student_id ON applications (student_id);
CREATE INDEX idx_applications_job_id ON applications (job_id);
CREATE INDEX idx_applications_status ON applications (status);

CREATE INDEX idx_recommendation_runs_student_id ON recommendation_runs (student_id);
CREATE INDEX idx_recommendation_runs_status ON recommendation_runs (status);

CREATE INDEX idx_recommendation_results_job_id ON recommendation_results (job_id);
CREATE INDEX idx_recommendation_results_score ON recommendation_results (score DESC);
