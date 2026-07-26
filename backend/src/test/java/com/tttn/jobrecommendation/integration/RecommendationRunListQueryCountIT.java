package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunResponse;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationQueryService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationRunListQueryCountIT extends AbstractPostgresIntegrationTest {

    private static final int MANY_RUN_COUNT = 20;
    private static final long EXPECTED_NON_EMPTY_STATEMENTS = 3L;
    private static final long EXPECTED_EMPTY_STATEMENTS = 2L;

    @Autowired
    private RecommendationQueryService recommendationQueryService;

    @Autowired
    private RecommendationRunRepository recommendationRunRepository;

    @Autowired
    private RecommendationResultRepository recommendationResultRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void recommendationRunListUsesOneGroupedCountQueryForOneAndTwentyRuns() {
        Student oneRunStudent = createStudent("one-recommendation-run@example.test");
        Student twentyRunStudent = createStudent("twenty-recommendation-runs@example.test");
        Student emptyRunStudent = createStudent("empty-recommendation-runs@example.test");
        CvFile oneRunCv = createCv(oneRunStudent, "one-recommendation-run.pdf", true);
        CvFile twentyRunCv = createCv(twentyRunStudent, "twenty-recommendation-runs.pdf", true);

        Company company = createCompany(
                "recommendation-run-query-count-company@example.test",
                "Recommendation Run Query Count Company",
                CompanyStatus.VERIFIED
        );
        List<Job> jobs = List.of(
                createJob(company, "Recommendation Backend Job", JobStatus.ACTIVE),
                createJob(company, "Recommendation Data Job", JobStatus.ACTIVE),
                createJob(company, "Recommendation Platform Job", JobStatus.ACTIVE)
        );

        ExpectedRun oneExpectedRun = createRun(
                oneRunStudent,
                oneRunCv,
                RecommendationSourceType.CV,
                RecommendationRunStatus.SUCCESS,
                LocalDateTime.of(2026, 2, 1, 0, 0),
                1,
                jobs
        );

        Map<Long, ExpectedRun> twentyExpectedRuns = new HashMap<>();
        LocalDateTime firstCreatedAt = LocalDateTime.of(2026, 3, 1, 0, 0);
        for (int index = 1; index <= MANY_RUN_COUNT; index++) {
            ExpectedRun expectedRun = createRun(
                    twentyRunStudent,
                    index % 2 == 0 ? twentyRunCv : null,
                    RecommendationSourceType.values()[(index - 1) % RecommendationSourceType.values().length],
                    RecommendationRunStatus.values()[(index - 1) % RecommendationRunStatus.values().length],
                    firstCreatedAt.plusMinutes(index),
                    (index - 1) % 4,
                    jobs
            );
            twentyExpectedRuns.put(expectedRun.id(), expectedRun);
        }

        Measurement oneRun = measure(oneRunStudent.getUser().getId());
        Measurement twentyRuns = measure(twentyRunStudent.getUser().getId());
        Measurement emptyRuns = measure(emptyRunStudent.getUser().getId());

        assertThat(oneRun.preparedStatements()).isEqualTo(EXPECTED_NON_EMPTY_STATEMENTS);
        assertThat(twentyRuns.preparedStatements())
                .isEqualTo(oneRun.preparedStatements())
                .isLessThanOrEqualTo(EXPECTED_NON_EMPTY_STATEMENTS);
        assertThat(emptyRuns.preparedStatements()).isEqualTo(EXPECTED_EMPTY_STATEMENTS);
        assertThat(List.of(oneRun.entityFetches(), twentyRuns.entityFetches(), emptyRuns.entityFetches()))
                .containsOnly(0L);

        assertThat(oneRun.responses())
                .singleElement()
                .satisfies(response -> assertRunResponse(response, oneExpectedRun));
        assertThat(emptyRuns.responses()).isEmpty();

        List<ExpectedRun> expectedOrder = new ArrayList<>(twentyExpectedRuns.values());
        expectedOrder.sort(Comparator.comparing(ExpectedRun::createdAt).reversed());
        assertThat(twentyRuns.responses())
                .extracting(RecommendationRunResponse::getId)
                .containsExactlyElementsOf(expectedOrder.stream().map(ExpectedRun::id).toList())
                .doesNotHaveDuplicates()
                .doesNotContain(oneExpectedRun.id());
        assertThat(twentyRuns.responses())
                .extracting(RecommendationRunResponse::getTotalRecommended)
                .contains(0, 1, 3);
        twentyRuns.responses().forEach(response ->
                assertRunResponse(response, twentyExpectedRuns.get(response.getId())));
    }

    private ExpectedRun createRun(
            Student student,
            CvFile cvFile,
            RecommendationSourceType sourceType,
            RecommendationRunStatus status,
            LocalDateTime createdAt,
            int resultCount,
            List<Job> jobs
    ) {
        LocalDateTime startedAt = createdAt.minusSeconds(30);
        LocalDateTime finishedAt = status == RecommendationRunStatus.PROCESSING
                ? null
                : createdAt.plusSeconds(30);
        RecommendationRun run = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(sourceType)
                .status(status)
                .finishedAt(finishedAt)
                .build());
        updateRunTimestamps(run.getId(), startedAt, finishedAt, createdAt);

        List<RecommendationResult> results = new ArrayList<>();
        for (int index = 0; index < resultCount; index++) {
            results.add(RecommendationResult.builder()
                    .run(run)
                    .job(jobs.get(index))
                    .score(BigDecimal.valueOf(index + 1L).movePointLeft(1))
                    .matchedKeywords(List.of("query-count-" + index))
                    .rankPosition(index + 1)
                    .build());
        }
        if (!results.isEmpty()) {
            recommendationResultRepository.saveAllAndFlush(results);
        }

        return new ExpectedRun(
                run.getId(),
                cvFile == null ? null : cvFile.getId(),
                sourceType,
                status,
                startedAt,
                finishedAt,
                createdAt,
                resultCount
        );
    }

    private void updateRunTimestamps(
            Long runId,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            LocalDateTime createdAt
    ) {
        if (finishedAt == null) {
            jdbcTemplate.update(
                    """
                    UPDATE recommendation_runs
                    SET started_at = ?, finished_at = NULL, created_at = ?
                    WHERE id = ?
                    """,
                    Timestamp.valueOf(startedAt),
                    Timestamp.valueOf(createdAt),
                    runId
            );
            return;
        }

        jdbcTemplate.update(
                """
                UPDATE recommendation_runs
                SET started_at = ?, finished_at = ?, created_at = ?
                WHERE id = ?
                """,
                Timestamp.valueOf(startedAt),
                Timestamp.valueOf(finishedAt),
                Timestamp.valueOf(createdAt),
                runId
        );
    }

    private Measurement measure(Long userId) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        List<RecommendationRunResponse> responses =
                recommendationQueryService.getMyRecommendationRuns(userId);
        return new Measurement(
                responses,
                statistics.getPrepareStatementCount(),
                statistics.getEntityFetchCount()
        );
    }

    private void assertRunResponse(RecommendationRunResponse response, ExpectedRun expected) {
        assertThat(expected).isNotNull();
        assertThat(response.getId()).isEqualTo(expected.id());
        assertThat(response.getCvId()).isEqualTo(expected.cvId());
        assertThat(response.getSourceType()).isEqualTo(expected.sourceType());
        assertThat(response.getStatus()).isEqualTo(expected.status());
        assertThat(response.getStartedAt()).isEqualTo(expected.startedAt());
        assertThat(response.getFinishedAt()).isEqualTo(expected.finishedAt());
        assertThat(response.getCreatedAt()).isEqualTo(expected.createdAt());
        assertThat(response.getTotalRecommended()).isEqualTo(expected.totalRecommended());
    }

    private record ExpectedRun(
            Long id,
            Long cvId,
            RecommendationSourceType sourceType,
            RecommendationRunStatus status,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            LocalDateTime createdAt,
            Integer totalRecommended
    ) {
    }

    private record Measurement(
            List<RecommendationRunResponse> responses,
            long preparedStatements,
            long entityFetches
    ) {
    }
}
