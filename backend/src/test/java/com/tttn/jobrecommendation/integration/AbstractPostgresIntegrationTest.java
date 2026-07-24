package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles(value = "integration", inheritProfiles = false)
@Testcontainers
public abstract class AbstractPostgresIntegrationTest {

    private static final DockerImageName POSTGRES_IMAGE = DockerImageName.parse("postgres:17-alpine");

    @ServiceConnection
    protected static final PostgreSQLContainer<?> POSTGRESQL = new PostgreSQLContainer<>(POSTGRES_IMAGE);

    static {
        // A suite-wide singleton keeps Spring's cached context connected to a live container across IT classes.
        POSTGRESQL.start();
    }

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected StudentRepository studentRepository;

    @Autowired
    protected CompanyRepository companyRepository;

    @Autowired
    protected JobRepository jobRepository;

    @Autowired
    protected CvFileRepository cvFileRepository;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    notifications,
                    user_notification_settings,
                    saved_candidates,
                    saved_searches,
                    recommendation_results,
                    recommendation_runs,
                    applications,
                    cv_files,
                    saved_jobs,
                    job_skills,
                    jobs,
                    student_skills,
                    skills,
                    student_profiles,
                    companies,
                    students,
                    users
                RESTART IDENTITY CASCADE
                """);
    }

    protected User createUser(String email, UserRole role) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .passwordHash("test-password-hash")
                .fullName("Integration Test User")
                .role(role)
                .status(UserStatus.ACTIVE)
                .build());
    }

    protected Student createStudent(String email) {
        User user = createUser(email, UserRole.STUDENT);
        return studentRepository.saveAndFlush(Student.builder()
                .user(user)
                .studentCode("IT-" + user.getId())
                .build());
    }

    protected Company createCompany(String email, String companyName, CompanyStatus status) {
        User user = createUser(email, UserRole.COMPANY);
        return companyRepository.saveAndFlush(Company.builder()
                .user(user)
                .companyName(companyName)
                .status(status)
                .build());
    }

    protected Job createJob(Company company, String title, JobStatus status) {
        return jobRepository.saveAndFlush(Job.builder()
                .company(company)
                .title(title)
                .description("Integration test job")
                .jobType(JobType.INTERNSHIP)
                .workingModel(WorkingModel.REMOTE)
                .status(status)
                .build());
    }

    protected CvFile createCv(Student student, String fileName, boolean active) {
        return cvFileRepository.saveAndFlush(CvFile.builder()
                .student(student)
                .fileName(fileName)
                .originalFileName(fileName)
                .storedFileName(fileName)
                .fileUrl("uploads/cvs/" + fileName)
                .filePath("uploads/cvs/" + fileName)
                .contentType("application/pdf")
                .fileSize(128L)
                .active(active)
                .build());
    }
}
