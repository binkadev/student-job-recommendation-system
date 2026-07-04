# AGENTS.md

## Project
Student Job Recommendation System for IT students using Content-Based Filtering, TF-IDF and Cosine Similarity.

## Current Scope
This task is for BE Core only.

BE Core includes:
- Auth
- User
- Student profile
- Company profile
- Job management
- Application flow
- CV metadata skeleton
- Recommendation database tables only
- Swagger
- Common response and exception handling
- PostgreSQL + Flyway migrations

Do NOT implement full recommendation algorithm unless explicitly asked.

## Tech Stack
- Java 21
- Spring Boot 3.5.x
- Maven
- PostgreSQL
- Spring Data JPA / Hibernate
- Spring Security + JWT
- Flyway
- Swagger/OpenAPI
- Lombok
- Validation

## Package
Base package:
com.tttn.jobrecommendation

## Backend Structure

backend/src/main/java/com/tttn/jobrecommendation

- common/
    - config/
    - enums/
    - exception/
    - response/
    - security/
    - utils/

- modules/
    - auth/
    - user/
    - student/
    - company/
    - skill/
    - job/
    - application/
    - cv/
    - recommendation/

Each module must follow:
- controller/
- service/
- service/impl/ or ServiceImpl class
- repository/
- entity/
- dto/request/
- dto/response/
- mapper/

## Rules

1. Do not change unrelated modules.
2. Do not rename package names.
3. Do not introduce new dependencies without explaining why.
4. Do not use raw response objects. All APIs must use ApiResponse<T>.
5. Do not expose passwordHash in any response.
6. Do not hard delete business data such as jobs, applications, users.
7. Jobs must always belong to a company. jobs.company_id must not be nullable.
8. A student cannot apply to the same job twice.
9. A company can only manage its own jobs and applications.
10. Admin can manage all jobs and applications.
11. All request DTOs must use jakarta validation annotations where appropriate.
12. All database changes must be done through Flyway migration files.
13. Do not set Hibernate ddl-auto to create/drop in committed config.
14. After changes, ensure project compiles with Maven.
15. Update backend README if setup or API changes.

## API Response Format

Success:
{
"success": true,
"message": "Success",
"data": {}
}

Error:
{
"success": false,
"message": "Error message",
"errorCode": "ERROR_CODE",
"data": null
}

Pagination:
{
"success": true,
"message": "Success",
"data": {
"items": [],
"page": 1,
"size": 10,
"totalItems": 100,
"totalPages": 10
}
}

## Security Rules

Public:
- POST /api/auth/register
- POST /api/auth/login
- /swagger-ui/**
- /v3/api-docs/**

Authenticated:
- all other APIs

Roles:
- STUDENT: update own profile, view jobs, apply jobs, view own applications
- COMPANY: update own company profile, create/manage own jobs, view applications for own jobs
- ADMIN: manage all users/jobs/applications

## Database Design Rules

Use PostgreSQL.
Use BIGSERIAL primary keys.
Use VARCHAR for enum values.
Use created_at and updated_at on business tables.
Use soft status instead of hard delete.
Create indexes for frequently queried fields.
Use unique constraints for:
- users.email
- students.user_id
- companies.user_id
- student_profiles.student_id
- applications(student_id, job_id)
- saved_jobs(student_id, job_id)
- student_skills(student_id, skill_id)
- job_skills(job_id, skill_id)

## Before Finishing Any Task

Run or ensure:
- mvnw clean compile
- no unrelated file changes
- no broken imports
- no missing migrations
- no passwordHash in response DTOs