package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.dto.response.SavedJobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.SavedJob;
import com.tttn.jobrecommendation.modules.job.repository.SavedJobRepository;
import com.tttn.jobrecommendation.modules.job.service.SavedJobService;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SavedJobListQueryCountIT extends AbstractPostgresIntegrationTest {

    private static final int MANY_SAVED_JOB_COUNT = 20;
    private static final long MAX_NON_EMPTY_STATEMENTS = 4L;
    private static final long EXPECTED_EMPTY_STATEMENTS = 2L;

    @Autowired
    private SavedJobService savedJobService;

    @Autowired
    private SavedJobRepository savedJobRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void savedJobListQueryCountIsBoundedAcrossOneTwentyAndEmptyResults() {
        Student oneSavedJobStudent = createStudent("one-saved-job-query-count@example.test");
        Student twentySavedJobsStudent = createStudent("twenty-saved-jobs-query-count@example.test");
        Student emptySavedJobsStudent = createStudent("empty-saved-jobs-query-count@example.test");

        List<Company> companies = List.of(
                createCompany(
                        "saved-job-company-1@example.test",
                        "Saved Job Company One",
                        CompanyStatus.VERIFIED
                ),
                createCompany(
                        "saved-job-company-2@example.test",
                        "Saved Job Company Two",
                        CompanyStatus.VERIFIED
                ),
                createCompany(
                        "saved-job-company-3@example.test",
                        "Saved Job Company Three",
                        CompanyStatus.VERIFIED
                ),
                createCompany(
                        "saved-job-company-4@example.test",
                        "Saved Job Company Four",
                        CompanyStatus.VERIFIED
                )
        );

        List<JobFixture> jobs = createJobs(companies);
        ExpectedSavedJob oneExpected = createSavedJob(
                oneSavedJobStudent,
                jobs.getFirst(),
                LocalDateTime.of(2026, 4, 1, 0, 0)
        );

        Map<Long, ExpectedSavedJob> twentyExpected = new HashMap<>();
        LocalDateTime firstSavedAt = LocalDateTime.of(2026, 5, 1, 0, 0);
        for (int index = 0; index < MANY_SAVED_JOB_COUNT; index++) {
            ExpectedSavedJob expected = createSavedJob(
                    twentySavedJobsStudent,
                    jobs.get(index),
                    firstSavedAt.plusMinutes(index)
            );
            twentyExpected.put(expected.savedJobId(), expected);
        }

        Measurement oneResult = measure(oneSavedJobStudent.getUser().getId(), 1, 1);
        Measurement twentyResults = measure(twentySavedJobsStudent.getUser().getId(), 1, MANY_SAVED_JOB_COUNT);
        Measurement emptyResult = measure(emptySavedJobsStudent.getUser().getId(), 1, MANY_SAVED_JOB_COUNT);

        assertThat(twentyResults.preparedStatements())
                .isEqualTo(oneResult.preparedStatements())
                .isLessThanOrEqualTo(MAX_NON_EMPTY_STATEMENTS);
        assertThat(emptyResult.preparedStatements()).isEqualTo(EXPECTED_EMPTY_STATEMENTS);
        assertThat(List.of(
                oneResult.entityFetches(),
                twentyResults.entityFetches(),
                emptyResult.entityFetches()
        )).containsOnly(0L);

        assertPage(oneResult.response(), 1, 1, 1, 1L, 1);
        assertPage(
                twentyResults.response(),
                1,
                MANY_SAVED_JOB_COUNT,
                MANY_SAVED_JOB_COUNT,
                MANY_SAVED_JOB_COUNT,
                1
        );
        assertPage(emptyResult.response(), 1, MANY_SAVED_JOB_COUNT, 0, 0L, 0);

        assertThat(oneResult.response().getItems())
                .singleElement()
                .satisfies(response -> assertSavedJobResponse(response, oneExpected));
        assertThat(emptyResult.response().getItems()).isEmpty();

        List<ExpectedSavedJob> expectedOrder = new ArrayList<>(twentyExpected.values());
        expectedOrder.sort(Comparator.comparing(ExpectedSavedJob::savedAt).reversed());
        assertThat(twentyResults.response().getItems())
                .extracting(SavedJobResponse::getSavedJobId)
                .containsExactlyElementsOf(expectedOrder.stream().map(ExpectedSavedJob::savedJobId).toList())
                .doesNotHaveDuplicates()
                .doesNotContain(oneExpected.savedJobId());
        twentyResults.response().getItems().forEach(response ->
                assertSavedJobResponse(response, twentyExpected.get(response.getSavedJobId())));
    }

    private List<JobFixture> createJobs(List<Company> companies) {
        List<JobFixture> jobs = new ArrayList<>();
        for (int index = 0; index < MANY_SAVED_JOB_COUNT; index++) {
            Company company = index < 10
                    ? companies.getFirst()
                    : companies.get(1 + (index % (companies.size() - 1)));
            Job job = createJob(
                    company,
                    "Saved Job Title " + (index + 1),
                    JobStatus.values()[index % JobStatus.values().length]
            );
            job.setLocation("Saved Job Location " + (index + 1));
            job.setJobType(JobType.values()[index % JobType.values().length]);
            job.setWorkingModel(WorkingModel.values()[index % WorkingModel.values().length]);
            jobs.add(new JobFixture(jobRepository.saveAndFlush(job), company.getCompanyName()));
        }
        return jobs;
    }

    private ExpectedSavedJob createSavedJob(Student student, JobFixture jobFixture, LocalDateTime savedAt) {
        Job job = jobFixture.job();
        SavedJob savedJob = savedJobRepository.saveAndFlush(SavedJob.builder()
                .student(student)
                .job(job)
                .build());
        jdbcTemplate.update(
                "UPDATE saved_jobs SET created_at = ? WHERE id = ?",
                Timestamp.valueOf(savedAt),
                savedJob.getId()
        );
        return new ExpectedSavedJob(
                savedJob.getId(),
                job.getId(),
                job.getTitle(),
                jobFixture.companyName(),
                job.getLocation(),
                job.getJobType(),
                job.getWorkingModel(),
                job.getStatus(),
                savedAt
        );
    }

    private Measurement measure(Long userId, int page, int size) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        PageResponse<SavedJobResponse> response = savedJobService.getMySavedJobs(userId, page, size);
        return new Measurement(
                response,
                statistics.getPrepareStatementCount(),
                statistics.getEntityFetchCount()
        );
    }

    private void assertPage(
            PageResponse<SavedJobResponse> response,
            int expectedPage,
            int expectedSize,
            int expectedItemCount,
            long expectedTotalItems,
            int expectedTotalPages
    ) {
        assertThat(response.getItems()).hasSize(expectedItemCount);
        assertThat(response.getPage()).isEqualTo(expectedPage);
        assertThat(response.getSize()).isEqualTo(expectedSize);
        assertThat(response.getTotalItems()).isEqualTo(expectedTotalItems);
        assertThat(response.getTotalPages()).isEqualTo(expectedTotalPages);
    }

    private void assertSavedJobResponse(SavedJobResponse response, ExpectedSavedJob expected) {
        assertThat(expected).isNotNull();
        assertThat(response.getSavedJobId()).isEqualTo(expected.savedJobId());
        assertThat(response.getJobId()).isEqualTo(expected.jobId());
        assertThat(response.getTitle()).isEqualTo(expected.title());
        assertThat(response.getCompanyName()).isEqualTo(expected.companyName());
        assertThat(response.getLocation()).isEqualTo(expected.location());
        assertThat(response.getJobType()).isEqualTo(expected.jobType());
        assertThat(response.getWorkingModel()).isEqualTo(expected.workingModel());
        assertThat(response.getStatus()).isEqualTo(expected.status());
        assertThat(response.getSavedAt()).isEqualTo(expected.savedAt());
    }

    private record ExpectedSavedJob(
            Long savedJobId,
            Long jobId,
            String title,
            String companyName,
            String location,
            JobType jobType,
            WorkingModel workingModel,
            JobStatus status,
            LocalDateTime savedAt
    ) {
    }

    private record JobFixture(Job job, String companyName) {
    }

    private record Measurement(
            PageResponse<SavedJobResponse> response,
            long preparedStatements,
            long entityFetches
    ) {
    }
}
