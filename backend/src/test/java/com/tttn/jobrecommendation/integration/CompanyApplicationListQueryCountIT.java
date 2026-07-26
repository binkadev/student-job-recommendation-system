package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.dto.request.CompanyApplicationFilterRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.application.service.ApplicationService;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CompanyApplicationListQueryCountIT extends AbstractPostgresIntegrationTest {

    private static final int APPLICATION_COUNT = 21;
    private static final int PAGE_SIZE = 20;
    private static final long MAX_SERVICE_STATEMENTS = 4L;

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private JobApplicationRepository applicationRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void companyApplicationListQueryCountIsBoundedAcrossOneTwentyAndEmptyResults() {
        Company company = createCompany(
                "application-query-count-company@example.test",
                "Application Query Count Company",
                CompanyStatus.VERIFIED
        );
        Company otherCompany = createCompany(
                "other-application-query-count-company@example.test",
                "Other Application Query Count Company",
                CompanyStatus.VERIFIED
        );
        List<Job> companyJobs = List.of(
                createJob(company, "Backend Intern", JobStatus.ACTIVE),
                createJob(company, "Data Intern", JobStatus.ACTIVE),
                createJob(company, "Platform Intern", JobStatus.ACTIVE),
                createJob(company, "QA Intern", JobStatus.ACTIVE)
        );

        Map<Long, ExpectedApplication> expectedApplications = new HashMap<>();
        LocalDateTime firstAppliedAt = LocalDateTime.of(2026, 1, 1, 0, 0);
        for (int index = 1; index <= APPLICATION_COUNT; index++) {
            Student student = createStudent("application-query-count-student-" + index + "@example.test");
            String studentName = "Application Student " + index;
            student.getUser().setFullName(studentName);
            userRepository.saveAndFlush(student.getUser());

            CvFile cvFile = index % 2 == 0
                    ? createCv(student, "application-query-count-" + index + ".pdf", index % 4 == 0)
                    : null;
            Job job = companyJobs.get((index - 1) % companyJobs.size());
            ApplicationStatus status = ApplicationStatus.values()[(index - 1) % ApplicationStatus.values().length];
            JobApplication application = applicationRepository.saveAndFlush(JobApplication.builder()
                    .student(student)
                    .job(job)
                    .cvFile(cvFile)
                    .status(status)
                    .coverLetter("Cover letter " + index)
                    .build());
            jdbcTemplate.update(
                    "UPDATE applications SET applied_at = ? WHERE id = ?",
                    Timestamp.valueOf(firstAppliedAt.plusMinutes(index)),
                    application.getId()
            );

            expectedApplications.put(application.getId(), new ExpectedApplication(
                    student.getId(),
                    studentName,
                    student.getUser().getEmail(),
                    job.getId(),
                    job.getTitle(),
                    company.getId(),
                    company.getCompanyName(),
                    cvFile == null ? null : cvFile.getId(),
                    cvFile == null ? null : cvFile.getFileName(),
                    status
            ));
        }

        JobApplication otherCompanyApplication = createOtherCompanyApplication(otherCompany);

        Measurement oneResult = measure(company.getUser().getId(), 21, 1);
        Measurement twentyResults = measure(company.getUser().getId(), 1, PAGE_SIZE);
        Measurement emptyPage = measure(company.getUser().getId(), 3, PAGE_SIZE);

        assertThat(oneResult.preparedStatements())
                .isEqualTo(twentyResults.preparedStatements())
                .isLessThanOrEqualTo(MAX_SERVICE_STATEMENTS);
        assertThat(emptyPage.preparedStatements())
                .as("an empty content page must not trigger relationship lazy-loading statements")
                .isEqualTo(twentyResults.preparedStatements())
                .isLessThanOrEqualTo(MAX_SERVICE_STATEMENTS);
        assertThat(emptyPage.entityFetches())
                .as("an empty page must not perform any lazy entity fetch")
                .isZero();

        assertPage(oneResult.response(), 21, 1, 1, APPLICATION_COUNT);
        assertPage(twentyResults.response(), 1, PAGE_SIZE, PAGE_SIZE, 2);
        assertPage(emptyPage.response(), 3, PAGE_SIZE, 0, 2);

        List<ApplicationResponse> returnedApplications = new ArrayList<>(twentyResults.response().getItems());
        returnedApplications.addAll(oneResult.response().getItems());

        assertThat(returnedApplications)
                .extracting(ApplicationResponse::getId)
                .doesNotHaveDuplicates()
                .hasSize(APPLICATION_COUNT)
                .doesNotContain(otherCompanyApplication.getId());
        assertThat(returnedApplications)
                .extracting(ApplicationResponse::getCompanyId)
                .containsOnly(company.getId());
        returnedApplications.forEach(response ->
                assertApplicationResponse(response, expectedApplications.get(response.getId())));
    }

    private JobApplication createOtherCompanyApplication(Company otherCompany) {
        Student student = createStudent("other-company-application-student@example.test");
        student.getUser().setFullName("Other Company Student");
        userRepository.saveAndFlush(student.getUser());
        Job job = createJob(otherCompany, "Other Company Job", JobStatus.ACTIVE);
        return applicationRepository.saveAndFlush(JobApplication.builder()
                .student(student)
                .job(job)
                .status(ApplicationStatus.PENDING)
                .build());
    }

    private Measurement measure(Long companyUserId, int page, int size) {
        CompanyApplicationFilterRequest request = new CompanyApplicationFilterRequest();
        request.setPage(page);
        request.setSize(size);
        request.setSort("appliedAt,desc");

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        PageResponse<ApplicationResponse> response =
                applicationService.getMyCompanyApplications(companyUserId, request);
        return new Measurement(
                response,
                statistics.getPrepareStatementCount(),
                statistics.getEntityFetchCount()
        );
    }

    private void assertPage(
            PageResponse<ApplicationResponse> response,
            int expectedPage,
            int expectedSize,
            int expectedItems,
            int expectedTotalPages
    ) {
        assertThat(response.getItems()).hasSize(expectedItems);
        assertThat(response.getPage()).isEqualTo(expectedPage);
        assertThat(response.getSize()).isEqualTo(expectedSize);
        assertThat(response.getTotalItems()).isEqualTo(APPLICATION_COUNT);
        assertThat(response.getTotalPages()).isEqualTo(expectedTotalPages);
    }

    private void assertApplicationResponse(
            ApplicationResponse response,
            ExpectedApplication expected
    ) {
        assertThat(expected).isNotNull();
        assertThat(response.getStudentId()).isEqualTo(expected.studentId());
        assertThat(response.getStudentName()).isEqualTo(expected.studentName());
        assertThat(response.getStudentEmail()).isEqualTo(expected.studentEmail());
        assertThat(response.getJobId()).isEqualTo(expected.jobId());
        assertThat(response.getJobTitle()).isEqualTo(expected.jobTitle());
        assertThat(response.getCompanyId()).isEqualTo(expected.companyId());
        assertThat(response.getCompanyName()).isEqualTo(expected.companyName());
        assertThat(response.getCvFileId()).isEqualTo(expected.cvFileId());
        assertThat(response.getCvFileName()).isEqualTo(expected.cvFileName());
        assertThat(response.getStatus()).isEqualTo(expected.status());
    }

    private record ExpectedApplication(
            Long studentId,
            String studentName,
            String studentEmail,
            Long jobId,
            String jobTitle,
            Long companyId,
            String companyName,
            Long cvFileId,
            String cvFileName,
            ApplicationStatus status
    ) {
    }

    private record Measurement(
            PageResponse<ApplicationResponse> response,
            long preparedStatements,
            long entityFetches
    ) {
    }
}
