package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.CandidateRankingPublicService;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CandidateRankingPublicQueryCountIT extends AbstractPostgresIntegrationTest {

    private static final int MANY = 20;
    private static final long LIST_STATEMENT_CEILING = 5L;
    private static final long DETAIL_STATEMENT_CEILING = 4L;

    @Autowired
    private CandidateRankingPublicService publicService;

    @Autowired
    private CandidateRankingRunRepository runRepository;

    @Autowired
    private CandidateRankingResultRepository resultRepository;

    @Autowired
    private JobApplicationRepository applicationRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void listAndDetailQueryCountsRemainBoundedAsPageAndResultSizesGrow() {
        Company company = createCompany(
                "ranking-query-count-company@example.test",
                "Ranking Query Count",
                CompanyStatus.VERIFIED
        );
        Job listJob = createJob(company, "List Query Count Job", JobStatus.ACTIVE);
        Job detailJob = createJob(company, "Detail Query Count Job", JobStatus.ACTIVE);

        List<CandidateRankingRun> listRuns = new ArrayList<>();
        for (int index = 0; index < MANY + 1; index++) {
            CandidateRankingRun run = createRun(listJob);
            listRuns.add(run);
            if (index % 2 == 0) {
                createResult(run, 1, "list-" + index);
            }
        }
        CandidateRankingRun oneResultRun = createRun(detailJob);
        createResult(oneResultRun, 1, "detail-one");
        CandidateRankingRun manyResultRun = createRun(detailJob);
        for (int rank = 1; rank <= MANY; rank++) {
            createResult(manyResultRun, rank, "detail-many-" + rank);
        }

        Measurement listOne = measure(() -> publicService.getRuns(
                company.getUser().getId(), listJob.getId(), 1, 1
        ));
        Measurement listTwenty = measure(() -> publicService.getRuns(
                company.getUser().getId(), listJob.getId(), 1, MANY
        ));
        Measurement detailOne = measure(() -> publicService.getRunDetail(
                company.getUser().getId(), detailJob.getId(), oneResultRun.getId()
        ));
        Measurement detailTwenty = measure(() -> publicService.getRunDetail(
                company.getUser().getId(), detailJob.getId(), manyResultRun.getId()
        ));

        assertThat(listTwenty.preparedStatements())
                .isEqualTo(listOne.preparedStatements())
                .isLessThanOrEqualTo(LIST_STATEMENT_CEILING);
        assertThat(detailTwenty.preparedStatements())
                .isEqualTo(detailOne.preparedStatements())
                .isLessThanOrEqualTo(DETAIL_STATEMENT_CEILING);
        assertThat(List.of(
                listOne.entityFetches(),
                listTwenty.entityFetches(),
                detailOne.entityFetches(),
                detailTwenty.entityFetches()
        )).containsOnly(0L);
    }

    private CandidateRankingRun createRun(Job job) {
        return runRepository.saveAndFlush(CandidateRankingRun.builder()
                .job(job)
                .requestId(UUID.randomUUID())
                .status(RecommendationRunStatus.SUCCESS)
                .algorithm("tfidf-cosine-hybrid")
                .algorithmVersion("bilingual-candidate-ranking-v2")
                .threshold(new BigDecimal("0.10000"))
                .requestedLimit(100)
                .totalApplicationsScanned(0)
                .eligibleCandidates(0)
                .skippedNoCv(0)
                .skippedNotReady(0)
                .skippedTerminalStatus(0)
                .inputFingerprint("b".repeat(64))
                .jobUpdatedAtSnapshot(job.getUpdatedAt())
                .finishedAt(LocalDateTime.now())
                .build());
    }

    private void createResult(CandidateRankingRun run, int rank, String suffix) {
        Student student = createStudent("ranking-query-" + suffix + "@example.test");
        CvFile cv = createCv(student, suffix + ".pdf", false);
        JobApplication application = applicationRepository.saveAndFlush(JobApplication.builder()
                .student(student)
                .job(run.getJob())
                .cvFile(cv)
                .status(ApplicationStatus.PENDING)
                .build());
        resultRepository.saveAndFlush(CandidateRankingResult.builder()
                .run(run)
                .application(application)
                .cvFile(cv)
                .score(new BigDecimal("0.80000"))
                .textScore(new BigDecimal("0.80000"))
                .skillScore(new BigDecimal("0.00000"))
                .scoringStrategy(RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID)
                .matchedSkills(List.of())
                .missingSkills(List.of())
                .reason("Persisted query-count reason")
                .rankPosition(rank)
                .build());
    }

    private Measurement measure(Runnable query) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        query.run();
        return new Measurement(statistics.getPrepareStatementCount(), statistics.getEntityFetchCount());
    }

    private record Measurement(long preparedStatements, long entityFetches) {
    }
}
