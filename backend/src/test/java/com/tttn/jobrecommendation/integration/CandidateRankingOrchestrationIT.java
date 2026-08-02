package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.CandidateRankingGenerationService;
import com.tttn.jobrecommendation.modules.candidateranking.service.CandidateRankingTransactionService;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingGenerationContext;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateRankingOrchestrationIT extends AbstractPostgresIntegrationTest {

    private static final BigDecimal ZERO_THRESHOLD = new BigDecimal("0.00000");
    private static final int LIMIT = 20;

    @MockitoBean
    private AiServiceClient aiServiceClient;

    @MockitoSpyBean
    private CandidateRankingResultRepository resultRepository;

    @Autowired
    private CandidateRankingRunRepository runRepository;

    @Autowired
    private CandidateRankingGenerationService generationService;

    @Autowired
    private CandidateRankingTransactionService transactionService;

    @Autowired
    private JobApplicationRepository applicationRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private DataSource dataSource;

    @DynamicPropertySource
    static void enableHibernateStatistics(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Test
    void processingIsCommittedAndAiRunsWithoutTransactionBeforeAtomicSuccess() {
        RankingFixture fixture = fixture("committed", 2);
        AtomicBoolean transactionActiveAtAi = new AtomicBoolean(true);
        AtomicReference<String> committedStatusAtAi = new AtomicReference<>();
        when(aiServiceClient.rankCandidates(any(), anyString())).thenAnswer(invocation -> {
            AiCandidateRankingRequest request = invocation.getArgument(0);
            transactionActiveAtAi.set(TransactionSynchronizationManager.isActualTransactionActive());
            committedStatusAtAi.set(jdbcTemplate.queryForObject(
                    "SELECT status FROM candidate_ranking_runs WHERE request_id = ?",
                    String.class,
                    request.requestId()
            ));
            return validResponse(request, true);
        });

        Long runId = generationService.generate(
                fixture.company().getId(),
                fixture.job().getId(),
                ZERO_THRESHOLD,
                LIMIT
        );

        assertThat(transactionActiveAtAi.get()).isFalse();
        assertThat(committedStatusAtAi.get()).isEqualTo("PROCESSING");
        verify(aiServiceClient).rankCandidates(any(AiCandidateRankingRequest.class), anyString());

        CandidateRankingRun run = runRepository.findById(runId).orElseThrow();
        assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(run.getAlgorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(run.getAlgorithmVersion()).isEqualTo("bilingual-candidate-ranking-v2");
        assertThat(run.getFinishedAt()).isNotNull();

        List<CandidateRankingResult> results = resultRepository.findByRunIdOrderByRankPositionAsc(runId);
        assertThat(results).hasSize(2);
        assertThat(results).extracting(CandidateRankingResult::getRankPosition).containsExactly(1, 2);
        assertThat(results).extracting(CandidateRankingResult::getScore)
                .containsExactly(new BigDecimal("0.90000"), new BigDecimal("0.80000"));
        assertThat(results).extracting(result -> result.getApplication().getId())
                .containsExactly(
                        fixture.applications().get(1).getId(),
                        fixture.applications().get(0).getId()
                );
        for (CandidateRankingResult result : results) {
            JobApplication application = fixture.applications().stream()
                    .filter(candidate -> candidate.getId().equals(result.getApplication().getId()))
                    .findFirst()
                    .orElseThrow();
            assertThat(result.getCvFile().getId()).isEqualTo(application.getCvFile().getId());
            assertThat(result.getCvProcessingVersion()).isEqualTo(application.getCvFile().getProcessingVersion());
            assertThat(result.getCvAnalyzedAtSnapshot()).isEqualTo(application.getCvFile().getAnalyzedAt());
        }
    }

    @Test
    void emptyCorpusSucceedsWithoutAiAndPreservesCountersAndFingerprintRecheck() {
        Company company = createCompany(
                "ranking-empty-company@example.test",
                "Ranking Empty",
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Empty Ranking Job", JobStatus.CLOSED);
        Student terminalStudent = createStudent("ranking-empty-terminal@example.test");
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(terminalStudent)
                .job(job)
                .status(ApplicationStatus.REJECTED)
                .build());
        Student noCvStudent = createStudent("ranking-empty-no-cv@example.test");
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(noCvStudent)
                .job(job)
                .status(ApplicationStatus.PENDING)
                .build());
        Student notReadyStudent = createStudent("ranking-empty-not-ready@example.test");
        CvFile notReady = createCv(notReadyStudent, "not-ready.pdf", false);
        applicationRepository.saveAndFlush(JobApplication.builder()
                .student(notReadyStudent)
                .job(job)
                .cvFile(notReady)
                .status(ApplicationStatus.REVIEWED)
                .build());

        Long runId = generationService.generate(company.getId(), job.getId(), ZERO_THRESHOLD, LIMIT);

        verify(aiServiceClient, never()).rankCandidates(any(), anyString());
        CandidateRankingRun run = runRepository.findById(runId).orElseThrow();
        assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(run.getTotalApplicationsScanned()).isEqualTo(3);
        assertThat(run.getEligibleCandidates()).isZero();
        assertThat(run.getSkippedTerminalStatus()).isEqualTo(1);
        assertThat(run.getSkippedNoCv()).isEqualTo(1);
        assertThat(run.getSkippedNotReady()).isEqualTo(1);
        assertThat(run.getInputFingerprint()).matches("[0-9a-f]{64}");
        assertThat(resultRepository.findByRunIdOrderByRankPositionAsc(runId)).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(FingerprintMutation.class)
    void anyFingerprintMutationAfterAiCallFailsWithoutResults(FingerprintMutation mutation) {
        RankingFixture fixture = fixture("fingerprint-" + mutation.name().toLowerCase(), 1);
        CvFile replacementCv = mutation == FingerprintMutation.SUBMITTED_CV
                ? readyCv(fixture.students().getFirst(), "replacement.pdf", "Replacement CV", 99)
                : null;
        when(aiServiceClient.rankCandidates(any(), anyString())).thenAnswer(invocation -> {
            AiCandidateRankingRequest request = invocation.getArgument(0);
            applyMutation(mutation, fixture, replacementCv);
            return validResponse(request, false);
        });

        assertThatThrownBy(() -> generationService.generate(
                fixture.company().getId(),
                fixture.job().getId(),
                ZERO_THRESHOLD,
                LIMIT
        )).isInstanceOfSatisfying(AppException.class, exception -> {
            assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
            assertThat(exception.getMessage()).isEqualTo("Candidate ranking generation failed");
        });

        CandidateRankingRun failed = runRepository.findAll().getFirst();
        assertThat(failed.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(failed.getErrorMessage()).isEqualTo("Candidate ranking generation failed");
        assertThat(resultRepository.findAll()).isEmpty();
    }

    @Test
    void invalidAiResponsePersistsNoResultsAndFailsIndependently() {
        RankingFixture fixture = fixture("invalid-response", 1);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenAnswer(invocation -> {
            AiCandidateRankingRequest request = invocation.getArgument(0);
            return new AiCandidateRankingResponse(
                    UUID.randomUUID(),
                    "tfidf-cosine-hybrid",
                    "bilingual-candidate-ranking-v2",
                    validResponse(request, false).results()
            );
        });

        assertThatThrownBy(() -> generationService.generate(
                fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
        )).isInstanceOfSatisfying(AppException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));

        CandidateRankingRun run = runRepository.findAll().getFirst();
        assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(run.getErrorMessage()).isEqualTo("AI service returned an invalid response");
        assertThat(resultRepository.findAll()).isEmpty();
    }

    @Test
    void resultFlushFailureRollsBackEveryResultAndMarksRunFailedInNewTransaction() {
        RankingFixture fixture = fixture("persistence-failure", 2);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenAnswer(invocation ->
                validResponse(invocation.getArgument(0), true));
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new DataIntegrityViolationException(
                    "jdbc:postgresql://secret@internal raw response and CV text"
            );
        }).when(resultRepository).saveAllAndFlush(anyList());

        assertThatThrownBy(() -> generationService.generate(
                fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
        )).isInstanceOfSatisfying(AppException.class, exception ->
                assertThat(exception.getErrorCode())
                        .isEqualTo(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM candidate_ranking_results",
                Long.class
        )).isZero();
        CandidateRankingRun failed = runRepository.findAll().getFirst();
        assertThat(failed.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(failed.getAlgorithm()).isNull();
        assertThat(failed.getAlgorithmVersion()).isNull();
        assertThat(failed.getErrorMessage())
                .isEqualTo("Candidate ranking generation failed")
                .doesNotContain("jdbc", "secret", "internal", "raw response", "CV text");
    }

    @Test
    void existingProcessingRunUsesApplicationLevelConflict() {
        RankingFixture fixture = fixture("already-processing", 0);
        CandidateRankingGenerationContext first = transactionService.createProcessingRun(
                fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
        );

        assertThatThrownBy(() -> generationService.generate(
                fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
        )).isInstanceOfSatisfying(AppException.class, exception ->
                assertThat(exception.getErrorCode())
                        .isEqualTo(ErrorCode.CANDIDATE_RANKING_ALREADY_PROCESSING));

        assertThat(runRepository.findAll()).singleElement().satisfies(run -> {
            assertThat(run.getId()).isEqualTo(first.runId());
            assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.PROCESSING);
        });
        verify(aiServiceClient, never()).rankCandidates(any(), anyString());
    }

    @Test
    void concurrentPreparationRaceMapsOnlyPartialIndexLoserToSameConflict() throws Exception {
        RankingFixture fixture = fixture("concurrent-race", 0);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try (Connection lockConnection = dataSource.getConnection()) {
            lockConnection.setAutoCommit(false);
            lockConnection.createStatement().execute(
                    "LOCK TABLE candidate_ranking_runs IN SHARE ROW EXCLUSIVE MODE"
            );
            List<Future<Object>> futures = List.of(
                    executor.submit(() -> createProcessingOutcome(fixture)),
                    executor.submit(() -> createProcessingOutcome(fixture))
            );
            await().atMost(Duration.ofSeconds(10)).pollInterval(Duration.ofMillis(50)).untilAsserted(() ->
                    assertThat(countBlockedCandidateRankingInserts(lockConnection)).isEqualTo(2L)
            );
            lockConnection.commit();

            List<Object> outcomes = new ArrayList<>();
            for (Future<Object> future : futures) {
                outcomes.add(future.get(20, TimeUnit.SECONDS));
            }

            assertThat(outcomes).filteredOn(CandidateRankingGenerationContext.class::isInstance).hasSize(1);
            assertThat(outcomes).filteredOn(AppException.class::isInstance).singleElement().satisfies(outcome ->
                    assertThat(((AppException) outcome).getErrorCode())
                            .isEqualTo(ErrorCode.CANDIDATE_RANKING_ALREADY_PROCESSING));
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM candidate_ranking_runs WHERE job_id = ? AND status = 'PROCESSING'",
                    Long.class,
                    fixture.job().getId()
            )).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void unrelatedPostgresConstraintViolationIsNotMisclassifiedAsAlreadyProcessing() {
        RankingFixture fixture = fixture("unrelated-constraint", 0);

        assertThatThrownBy(() -> transactionService.createProcessingRun(
                fixture.company().getId(),
                fixture.job().getId(),
                new BigDecimal("-0.10000"),
                LIMIT
        )).isInstanceOf(DataIntegrityViolationException.class)
                .isNotInstanceOf(AppException.class);
        assertThat(runRepository.findAll()).isEmpty();
    }

    @Test
    void markFailedNeverOverwritesSuccessAndCompleteSuccessRejectsNonProcessing() {
        RankingFixture fixture = fixture("state-transitions", 0);
        Long runId = generationService.generate(
                fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
        );
        CandidateRankingRun successful = runRepository.findById(runId).orElseThrow();
        LocalDateTime originalFinishedAt = successful.getFinishedAt();

        transactionService.markFailed(runId, new IllegalStateException("secret failure"));

        CandidateRankingRun unchanged = runRepository.findById(runId).orElseThrow();
        assertThat(unchanged.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(unchanged.getFinishedAt()).isEqualTo(originalFinishedAt);
        assertThat(unchanged.getErrorMessage()).isNull();
        assertThatThrownBy(() -> transactionService.completeSuccess(
                runId,
                fixture.company().getId(),
                fixture.job().getId(),
                emptyValidatedResponse()
        )).isInstanceOfSatisfying(AppException.class, exception ->
                assertThat(exception.getErrorCode())
                        .isEqualTo(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED));
        assertThat(runRepository.findById(runId).orElseThrow().getStatus())
                .isEqualTo(RecommendationRunStatus.SUCCESS);
    }

    @Test
    void concurrentMarkFailedWaitsForSuccessRowLockAndNeverOverwritesCommittedSuccess()
            throws Exception {
        RankingFixture fixture = fixture("locked-state-transition", 0);
        CandidateRankingGenerationContext context = transactionService.createProcessingRun(
                fixture.company().getId(),
                fixture.job().getId(),
                ZERO_THRESHOLD,
                LIMIT
        );
        CountDownLatch successHoldingRowLock = new CountDownLatch(1);
        CountDownLatch allowSuccessToCommit = new CountDownLatch(1);
        doAnswer(invocation -> {
            successHoldingRowLock.countDown();
            if (!allowSuccessToCommit.await(10, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out waiting to commit candidate ranking success");
            }
            return invocation.getArgument(0);
        }).when(resultRepository).saveAllAndFlush(anyList());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<RunStateSnapshot> successFuture = executor.submit(() -> {
                transactionService.completeSuccess(
                        context.runId(),
                        fixture.company().getId(),
                        fixture.job().getId(),
                        emptyValidatedResponse()
                );
                CandidateRankingRun successful = runRepository.findById(context.runId()).orElseThrow();
                return new RunStateSnapshot(
                        successful.getStatus(),
                        successful.getFinishedAt(),
                        successful.getErrorMessage()
                );
            });
            assertThat(successHoldingRowLock.await(10, TimeUnit.SECONDS)).isTrue();
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT status FROM candidate_ranking_runs WHERE id = ?",
                    String.class,
                    context.runId()
            )).isEqualTo("PROCESSING");

            Future<?> failureFuture = executor.submit(() ->
                    transactionService.markFailed(
                            context.runId(),
                            new AppException(ErrorCode.AI_SERVICE_TIMEOUT)
                    ));
            await().atMost(Duration.ofSeconds(10)).pollInterval(Duration.ofMillis(50)).untilAsserted(() ->
                    assertThat(countBlockedCandidateRankingRunLocks()).isEqualTo(1L)
            );
            assertThat(failureFuture).isNotDone();

            allowSuccessToCommit.countDown();
            RunStateSnapshot committedSuccess = successFuture.get(10, TimeUnit.SECONDS);
            failureFuture.get(10, TimeUnit.SECONDS);

            CandidateRankingRun finalRun = runRepository.findById(context.runId()).orElseThrow();
            assertThat(committedSuccess.status()).isEqualTo(RecommendationRunStatus.SUCCESS);
            assertThat(committedSuccess.finishedAt()).isNotNull();
            assertThat(committedSuccess.errorMessage()).isNull();
            assertThat(finalRun.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
            assertThat(finalRun.getFinishedAt()).isEqualTo(committedSuccess.finishedAt());
            assertThat(finalRun.getErrorMessage()).isEqualTo(committedSuccess.errorMessage());
        } finally {
            allowSuccessToCommit.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void successReadQueryCountDoesNotGrowPerRankedResult() {
        RankingFixture oneCandidate = fixture("query-one", 1);
        RankingFixture tenCandidates = fixture("query-ten", 10);
        when(aiServiceClient.rankCandidates(any(), anyString())).thenAnswer(invocation ->
                validResponse(invocation.getArgument(0), true));

        QueryMeasurement one = measureGeneration(oneCandidate);
        QueryMeasurement ten = measureGeneration(tenCandidates);

        assertThat(one.resultCount()).isEqualTo(1);
        assertThat(ten.resultCount()).isEqualTo(10);
        assertThat(ten.queryExecutions()).isEqualTo(one.queryExecutions());
        assertThat(ten.entityFetches()).isEqualTo(one.entityFetches());
    }

    private Object createProcessingOutcome(RankingFixture fixture) {
        try {
            return transactionService.createProcessingRun(
                    fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
            );
        } catch (RuntimeException exception) {
            return exception;
        }
    }

    private long countBlockedCandidateRankingInserts(Connection connection) {
        try (var statement = connection.createStatement();
             var resultSet = statement.executeQuery("""
                     SELECT COUNT(*)
                     FROM pg_stat_activity
                     WHERE query LIKE 'insert into candidate_ranking_runs%'
                       AND wait_event_type = 'Lock'
                     """)) {
            resultSet.next();
            return resultSet.getLong(1);
        } catch (java.sql.SQLException exception) {
            throw new IllegalStateException("Unable to inspect blocked candidate ranking inserts", exception);
        }
    }

    private long countBlockedCandidateRankingRunLocks() {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM pg_stat_activity
                WHERE query ILIKE '%candidate_ranking_runs%'
                  AND query ILIKE '%for%update%'
                  AND wait_event_type = 'Lock'
                """, Long.class);
    }

    private QueryMeasurement measureGeneration(RankingFixture fixture) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        Long runId = generationService.generate(
                fixture.company().getId(), fixture.job().getId(), ZERO_THRESHOLD, LIMIT
        );
        long queryExecutions = statistics.getQueryExecutionCount();
        long entityFetches = statistics.getEntityFetchCount();
        int resultCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM candidate_ranking_results WHERE run_id = ?",
                Integer.class,
                runId
        );
        return new QueryMeasurement(resultCount, queryExecutions, entityFetches);
    }

    private void applyMutation(
            FingerprintMutation mutation,
            RankingFixture fixture,
            CvFile replacementCv
    ) {
        JobApplication application = fixture.applications().getFirst();
        switch (mutation) {
            case APPLICATION_STATUS -> jdbcTemplate.update(
                    "UPDATE applications SET status = 'REJECTED' WHERE id = ?",
                    application.getId()
            );
            case SUBMITTED_CV -> jdbcTemplate.update(
                    "UPDATE applications SET cv_file_id = ? WHERE id = ?",
                    replacementCv.getId(),
                    application.getId()
            );
            case CV_EXTRACTED_TEXT -> jdbcTemplate.update(
                    "UPDATE cv_files SET extracted_text = 'Changed CV text' WHERE id = ?",
                    application.getCvFile().getId()
            );
            case JOB_TEXT -> jdbcTemplate.update(
                    "UPDATE jobs SET description = 'Changed Job description' WHERE id = ?",
                    fixture.job().getId()
            );
            case JOB_SKILL -> jdbcTemplate.update("""
                    INSERT INTO skills (name, normalized_name, created_at, updated_at)
                    VALUES ('Docker', 'docker', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """);
            default -> throw new IllegalArgumentException("Unsupported mutation");
        }
        if (mutation == FingerprintMutation.JOB_SKILL) {
            Long skillId = jdbcTemplate.queryForObject(
                    "SELECT id FROM skills WHERE normalized_name = 'docker'",
                    Long.class
            );
            jdbcTemplate.update("""
                    INSERT INTO job_skills (job_id, skill_id, importance, created_at, updated_at)
                    VALUES (?, ?, 'REQUIRED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, fixture.job().getId(), skillId);
        }
    }

    private RankingFixture fixture(String suffix, int candidateCount) {
        Company company = createCompany(
                "ranking-" + suffix + "-company@example.test",
                "Ranking " + suffix,
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Ranking " + suffix + " Job", JobStatus.ACTIVE);
        List<Student> students = new ArrayList<>();
        List<JobApplication> applications = new ArrayList<>();
        for (int index = 0; index < candidateCount; index++) {
            Student student = createStudent(
                    "ranking-" + suffix + "-student-" + index + "@example.test"
            );
            CvFile cv = readyCv(student, suffix + "-" + index + ".pdf", "Java CV " + index, index);
            JobApplication application = applicationRepository.saveAndFlush(JobApplication.builder()
                    .student(student)
                    .job(job)
                    .cvFile(cv)
                    .status(index % 2 == 0 ? ApplicationStatus.PENDING : ApplicationStatus.REVIEWED)
                    .build());
            students.add(student);
            applications.add(application);
        }
        applications.sort(Comparator.comparing(JobApplication::getId));
        return new RankingFixture(company, job, List.copyOf(students), List.copyOf(applications));
    }

    private CvFile readyCv(Student student, String fileName, String text, int minuteOffset) {
        CvFile cv = createCv(student, fileName, false);
        cv.setExtractedText(text);
        cv.setProcessedText(text.toLowerCase());
        cv.setExtractedSkills(List.of());
        cv.setAnalysisStatus(CvAnalysisStatus.READY);
        cv.setProcessingVersion("bilingual-nlp-v2-skills-v1");
        cv.setAnalyzedAt(LocalDateTime.of(2026, 8, 1, 10, 0).plusMinutes(minuteOffset));
        return cvFileRepository.saveAndFlush(cv);
    }

    private AiCandidateRankingResponse validResponse(
            AiCandidateRankingRequest request,
            boolean reverseScores
    ) {
        List<AiCandidateRankingResponse.Result> results = new ArrayList<>();
        for (int index = 0; index < request.candidates().size(); index++) {
            AiCandidateRankingRequest.CandidateInput candidate = request.candidates().get(index);
            BigDecimal score = reverseScores
                    ? index == 0
                            ? new BigDecimal("0.80000000")
                            : new BigDecimal("0.90000000")
                    : new BigDecimal("0.80000000");
            results.add(new AiCandidateRankingResponse.Result(
                    candidate.applicationId(),
                    candidate.cvId(),
                    score,
                    score,
                    new BigDecimal("0.00000000"),
                    RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                    List.of(),
                    List.of()
            ));
        }
        return new AiCandidateRankingResponse(
                request.requestId(),
                "tfidf-cosine-hybrid",
                "bilingual-candidate-ranking-v2",
                List.copyOf(results)
        );
    }

    private ValidatedCandidateRankingResponse emptyValidatedResponse() {
        return new ValidatedCandidateRankingResponse(
                "tfidf-cosine-hybrid",
                "bilingual-candidate-ranking-v2",
                List.of()
        );
    }

    private enum FingerprintMutation {
        APPLICATION_STATUS,
        SUBMITTED_CV,
        CV_EXTRACTED_TEXT,
        JOB_TEXT,
        JOB_SKILL
    }

    private record RankingFixture(
            Company company,
            Job job,
            List<Student> students,
            List<JobApplication> applications
    ) {
    }

    private record QueryMeasurement(
            int resultCount,
            long queryExecutions,
            long entityFetches
    ) {
    }

    private record RunStateSnapshot(
            RecommendationRunStatus status,
            LocalDateTime finishedAt,
            String errorMessage
    ) {
    }
}
