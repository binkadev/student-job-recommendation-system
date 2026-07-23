package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.SavedJob;
import com.tttn.jobrecommendation.modules.job.repository.SavedJobRepository;
import com.tttn.jobrecommendation.modules.notification.entity.UserNotificationSettings;
import com.tttn.jobrecommendation.modules.notification.repository.UserNotificationSettingsRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DatabaseConstraintIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private JobApplicationRepository jobApplicationRepository;

    @Autowired
    private SavedJobRepository savedJobRepository;

    @Autowired
    private SavedCandidateRepository savedCandidateRepository;

    @Autowired
    private UserNotificationSettingsRepository notificationSettingsRepository;

    @Test
    void rejectsDuplicateUserEmail() {
        String email = "duplicate-user@example.com";
        createUser(email, UserRole.STUDENT);

        User duplicate = User.builder()
                .email(email)
                .passwordHash("another-password-hash")
                .fullName("Duplicate User")
                .role(UserRole.COMPANY)
                .status(UserStatus.ACTIVE)
                .build();

        assertThatThrownBy(() -> userRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);

        Integer survivingUsers = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE email = ?",
                Integer.class,
                email
        );
        assertThat(survivingUsers).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateApplicationForSameStudentAndJob() {
        Student student = createStudent("application-student@example.com");
        Company company = createCompany(
                "application-company@example.com",
                "Application Constraint Company",
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Application Constraint Job", JobStatus.ACTIVE);

        jobApplicationRepository.saveAndFlush(application(student, job));

        assertThatThrownBy(() -> jobApplicationRepository.saveAndFlush(application(student, job)))
                .isInstanceOf(DataIntegrityViolationException.class);

        Integer survivingApplications = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM applications WHERE student_id = ? AND job_id = ?",
                Integer.class,
                student.getId(),
                job.getId()
        );
        assertThat(survivingApplications).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateSavedJobForSameStudentAndJob() {
        Student student = createStudent("saved-job-student@example.com");
        Company company = createCompany(
                "saved-job-company@example.com",
                "Saved Job Constraint Company",
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Saved Job Constraint Job", JobStatus.ACTIVE);

        savedJobRepository.saveAndFlush(savedJob(student, job));

        assertThatThrownBy(() -> savedJobRepository.saveAndFlush(savedJob(student, job)))
                .isInstanceOf(DataIntegrityViolationException.class);

        Integer survivingSavedJobs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM saved_jobs WHERE student_id = ? AND job_id = ?",
                Integer.class,
                student.getId(),
                job.getId()
        );
        assertThat(survivingSavedJobs).isEqualTo(1);
    }

    @Test
    void rejectsSecondActiveCvForSameStudent() {
        Student student = createStudent("active-cv-student@example.com");
        createCv(student, "active-a.pdf", true);

        CvFile secondActiveCv = CvFile.builder()
                .student(student)
                .fileName("active-b.pdf")
                .originalFileName("active-b.pdf")
                .storedFileName("active-b.pdf")
                .fileUrl("uploads/cvs/active-b.pdf")
                .filePath("uploads/cvs/active-b.pdf")
                .contentType("application/pdf")
                .fileSize(128L)
                .active(true)
                .build();

        assertThatThrownBy(() -> cvFileRepository.saveAndFlush(secondActiveCv))
                .isInstanceOf(DataIntegrityViolationException.class);

        Integer activeCvs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cv_files WHERE student_id = ? AND is_active = TRUE",
                Integer.class,
                student.getId()
        );
        Integer allCvs = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cv_files WHERE student_id = ?",
                Integer.class,
                student.getId()
        );
        assertThat(activeCvs).isEqualTo(1);
        assertThat(allCvs).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateSavedCandidateForSameCompanyAndStudent() {
        Student student = createStudent("saved-candidate-student@example.com");
        Company company = createCompany(
                "saved-candidate-company@example.com",
                "Saved Candidate Constraint Company",
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Saved Candidate Constraint Job", JobStatus.ACTIVE);
        JobApplication application = jobApplicationRepository.saveAndFlush(application(student, job));

        savedCandidateRepository.saveAndFlush(savedCandidate(company, student, application));

        assertThatThrownBy(() -> savedCandidateRepository.saveAndFlush(savedCandidate(company, student, application)))
                .isInstanceOf(DataIntegrityViolationException.class);

        Integer survivingSavedCandidates = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM saved_candidates WHERE company_id = ? AND student_id = ?",
                Integer.class,
                company.getId(),
                student.getId()
        );
        assertThat(survivingSavedCandidates).isEqualTo(1);
    }

    @Test
    void rejectsDuplicateNotificationSettingsForSameUser() {
        User user = createUser("notification-settings-constraint@example.com", UserRole.ADMIN);
        notificationSettingsRepository.saveAndFlush(notificationSettings(user));

        assertThatThrownBy(() -> notificationSettingsRepository.saveAndFlush(notificationSettings(user)))
                .isInstanceOf(DataIntegrityViolationException.class);

        Integer survivingSettings = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notification_settings WHERE user_id = ?",
                Integer.class,
                user.getId()
        );
        assertThat(survivingSettings).isEqualTo(1);
    }

    private JobApplication application(Student student, Job job) {
        return JobApplication.builder()
                .student(student)
                .job(job)
                .status(ApplicationStatus.PENDING)
                .build();
    }

    private SavedJob savedJob(Student student, Job job) {
        return SavedJob.builder()
                .student(student)
                .job(job)
                .build();
    }

    private SavedCandidate savedCandidate(Company company, Student student, JobApplication application) {
        return SavedCandidate.builder()
                .company(company)
                .student(student)
                .application(application)
                .build();
    }

    private UserNotificationSettings notificationSettings(User user) {
        return UserNotificationSettings.builder()
                .user(user)
                .applicationStatusEnabled(true)
                .jobStatusEnabled(true)
                .recommendationEnabled(true)
                .systemEnabled(true)
                .build();
    }
}
