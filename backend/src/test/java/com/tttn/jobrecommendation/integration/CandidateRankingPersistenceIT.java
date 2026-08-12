package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CandidateRankingPersistenceIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private CandidateRankingRunRepository runRepository;

    @Autowired
    private CandidateRankingResultRepository resultRepository;

    @Autowired
    private JobApplicationRepository applicationRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void requestIdIsUnique() {
        Company company = createCompany(
                "candidate-ranking-request-company@example.test",
                "Candidate Ranking Request Company",
                CompanyStatus.VERIFIED
        );
        Job firstJob = createJob(company, "First request job", JobStatus.ACTIVE);
        Job secondJob = createJob(company, "Second request job", JobStatus.ACTIVE);
        UUID requestId = UUID.randomUUID();

        runRepository.saveAndFlush(run(firstJob, RecommendationRunStatus.SUCCESS, requestId));

        assertThatThrownBy(() -> runRepository.saveAndFlush(
                run(secondJob, RecommendationRunStatus.SUCCESS, requestId)
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void onlyOneProcessingRunIsAllowedPerJob() {
        Job job = createJob(
                createCompany(
                        "candidate-ranking-processing-company@example.test",
                        "Candidate Ranking Processing Company",
                        CompanyStatus.VERIFIED
                ),
                "Processing constraint job",
                JobStatus.ACTIVE
        );
        runRepository.saveAndFlush(run(job, RecommendationRunStatus.PROCESSING, UUID.randomUUID()));

        assertThatThrownBy(() -> runRepository.saveAndFlush(
                run(job, RecommendationRunStatus.PROCESSING, UUID.randomUUID())
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void multipleSuccessAndFailedHistoricalRunsAreAllowed() {
        Job job = createJob(
                createCompany(
                        "candidate-ranking-history-company@example.test",
                        "Candidate Ranking History Company",
                        CompanyStatus.VERIFIED
                ),
                "Historical ranking job",
                JobStatus.CLOSED
        );
        CandidateRankingRun firstSuccess = runRepository.saveAndFlush(
                run(job, RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        runRepository.saveAndFlush(run(job, RecommendationRunStatus.FAILED, UUID.randomUUID()));
        CandidateRankingRun latestSuccess = runRepository.saveAndFlush(
                run(job, RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        runRepository.saveAndFlush(run(job, RecommendationRunStatus.FAILED, UUID.randomUUID()));

        assertThat(runRepository.findByJobId(
                job.getId(),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt", "id"))
        ).getTotalElements()).isEqualTo(4);
        assertThat(runRepository.findFirstByJobIdAndStatusOrderByCreatedAtDescIdDesc(
                job.getId(),
                RecommendationRunStatus.SUCCESS
        )).get()
                .extracting(CandidateRankingRun::getId)
                .isEqualTo(latestSuccess.getId());
        assertThat(runRepository.findByIdAndJobId(firstSuccess.getId(), job.getId()))
                .get()
                .extracting(CandidateRankingRun::getId)
                .isEqualTo(firstSuccess.getId());
    }

    @Test
    void runApplicationMustBeUnique() {
        PersistenceFixture fixture = fixture("run-application");
        CandidateRankingRun run = runRepository.saveAndFlush(
                run(fixture.job(), RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        resultRepository.saveAndFlush(result(
                run,
                fixture.application(),
                fixture.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        ));

        assertThatThrownBy(() -> resultRepository.saveAndFlush(result(
                run,
                fixture.application(),
                fixture.cvFile(),
                2,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        ))).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void runRankMustBeUnique() {
        Company company = createCompany(
                "candidate-ranking-rank-company@example.test",
                "Candidate Ranking Rank Company",
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Run rank constraint job", JobStatus.ACTIVE);
        ApplicationFixture first = applicationFixture(job, "rank-first");
        ApplicationFixture second = applicationFixture(job, "rank-second");
        CandidateRankingRun run = runRepository.saveAndFlush(
                run(job, RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        resultRepository.saveAndFlush(result(
                run,
                first.application(),
                first.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        ));

        assertThatThrownBy(() -> resultRepository.saveAndFlush(result(
                run,
                second.application(),
                second.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        ))).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void v3RankingFieldsAndV3RunLimitsPersistThroughJpa() {
        PersistenceFixture fixture = fixture("v3-fields");
        CandidateRankingRun run = run(fixture.job(), RecommendationRunStatus.SUCCESS, UUID.randomUUID());
        run.setRequestedLimit(null);
        run.setRequestedPrimaryLimit(20);
        run.setRequestedFallbackLimit(20);
        run = runRepository.saveAndFlush(run);

        CandidateRankingResult primary = result(
                run,
                fixture.application(),
                fixture.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        );
        primary.setRankingScore(new BigDecimal("0.72000"));
        primary.setOverallScore(new BigDecimal("0.72000"));
        primary.setRankingTier(RecommendationRankingTier.PRIMARY);
        primary.setTierRankPosition(1);
        resultRepository.saveAndFlush(primary);

        entityManager.clear();

        CandidateRankingRun reloadedRun = runRepository.findById(run.getId()).orElseThrow();
        CandidateRankingResult reloadedResult = resultRepository.findByRunIdOrderByRankPositionAsc(run.getId())
                .getFirst();
        assertThat(reloadedRun.getRequestedLimit()).isNull();
        assertThat(reloadedRun.getRequestedPrimaryLimit()).isEqualTo(20);
        assertThat(reloadedRun.getRequestedFallbackLimit()).isEqualTo(20);
        assertThat(reloadedResult.getRankingScore()).isEqualByComparingTo("0.72000");
        assertThat(reloadedResult.getOverallScore()).isEqualByComparingTo("0.72000");
        assertThat(reloadedResult.getRankingTier()).isEqualTo(RecommendationRankingTier.PRIMARY);
        assertThat(reloadedResult.getTierRankPosition()).isEqualTo(1);
        assertThat(reloadedResult.getScore()).isEqualByComparingTo("0.72000");
    }

    @ParameterizedTest
    @MethodSource("invalidScoreFields")
    void scoresMustRemainWithinRange(String scoreField, BigDecimal invalidValue) {
        PersistenceFixture fixture = fixture("score-" + scoreField);
        CandidateRankingRun run = runRepository.saveAndFlush(
                run(fixture.job(), RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        CandidateRankingResult result = result(
                run,
                fixture.application(),
                fixture.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        );
        switch (scoreField) {
            case "score" -> result.setScore(invalidValue);
            case "textScore" -> result.setTextScore(invalidValue);
            case "skillScore" -> result.setSkillScore(invalidValue);
            default -> throw new IllegalArgumentException("Unsupported score field");
        }

        assertThatThrownBy(() -> resultRepository.saveAndFlush(result))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @ParameterizedTest
    @MethodSource("invalidStrategyTextScores")
    void textScoreNullabilityMustMatchStrategy(
            RecommendationScoringStrategy strategy,
            BigDecimal textScore
    ) {
        PersistenceFixture fixture = fixture("strategy-" + strategy.name().toLowerCase());
        CandidateRankingRun run = runRepository.saveAndFlush(
                run(fixture.job(), RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        CandidateRankingResult result = result(
                run,
                fixture.application(),
                fixture.cvFile(),
                1,
                strategy
        );
        result.setTextScore(textScore);

        assertThatThrownBy(() -> resultRepository.saveAndFlush(result))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void countersMustBeConsistent() {
        Job job = createJob(
                createCompany(
                        "candidate-ranking-counter-company@example.test",
                        "Candidate Ranking Counter Company",
                        CompanyStatus.VERIFIED
                ),
                "Counter constraint job",
                JobStatus.ACTIVE
        );
        CandidateRankingRun inconsistent = run(job, RecommendationRunStatus.SUCCESS, UUID.randomUUID());
        inconsistent.setTotalApplicationsScanned(5);

        assertThatThrownBy(() -> runRepository.saveAndFlush(inconsistent))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void countersMustBeNonnegative() {
        Job job = createJob(
                createCompany(
                        "candidate-ranking-negative-counter-company@example.test",
                        "Candidate Ranking Negative Counter Company",
                        CompanyStatus.VERIFIED
                ),
                "Negative counter constraint job",
                JobStatus.ACTIVE
        );
        CandidateRankingRun negative = run(job, RecommendationRunStatus.FAILED, UUID.randomUUID());
        negative.setTotalApplicationsScanned(-1);
        negative.setEligibleCandidates(-1);

        assertThatThrownBy(() -> runRepository.saveAndFlush(negative))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void foreignKeysRestrictParentDeletion() {
        Job runOnlyJob = createJob(
                createCompany(
                        "candidate-ranking-run-fk-company@example.test",
                        "Candidate Ranking Run FK Company",
                        CompanyStatus.VERIFIED
                ),
                "Run foreign key job",
                JobStatus.ACTIVE
        );
        runRepository.saveAndFlush(run(runOnlyJob, RecommendationRunStatus.SUCCESS, UUID.randomUUID()));

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM jobs WHERE id = ?",
                runOnlyJob.getId()
        )).isInstanceOf(DataIntegrityViolationException.class);

        PersistenceFixture fixture = fixture("foreign-key");
        CandidateRankingRun run = runRepository.saveAndFlush(
                run(fixture.job(), RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        resultRepository.saveAndFlush(result(
                run,
                fixture.application(),
                fixture.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        ));

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM applications WHERE id = ?",
                fixture.application().getId()
        )).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM cv_files WHERE id = ?",
                fixture.cvFile().getId()
        )).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM candidate_ranking_runs WHERE id = ?",
                run.getId()
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void jsonSkillArraysPersistReloadAndRejectNonArrays() {
        PersistenceFixture fixture = fixture("json-skills");
        CandidateRankingRun run = runRepository.saveAndFlush(
                run(fixture.job(), RecommendationRunStatus.SUCCESS, UUID.randomUUID())
        );
        CandidateRankingResult saved = resultRepository.saveAndFlush(result(
                run,
                fixture.application(),
                fixture.cvFile(),
                1,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        ));

        entityManager.clear();

        List<CandidateRankingResult> reloaded = resultRepository.findByRunIdOrderByRankPositionAsc(run.getId());
        assertThat(reloaded).singleElement().satisfies(result -> {
            assertThat(result.getApplication().getId()).isEqualTo(fixture.application().getId());
            assertThat(result.getCvFile().getId()).isEqualTo(fixture.cvFile().getId());
            assertThat(result.getMatchedSkills()).containsExactly("java", "spring boot");
            assertThat(result.getMissingSkills()).containsExactly("docker");
            assertThat(result.getCvProcessingVersion()).isEqualTo("bilingual-nlp-v2-skills-v1");
            assertThat(result.getCvAnalyzedAtSnapshot()).isEqualTo(fixture.cvFile().getAnalyzedAt());
        });

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE candidate_ranking_results SET matched_skills = '{}'::jsonb WHERE id = ?",
                saved.getId()
        )).isInstanceOf(DataIntegrityViolationException.class);
    }

    private static Stream<Arguments> invalidScoreFields() {
        return Stream.of(
                Arguments.of("score", new BigDecimal("1.00001")),
                Arguments.of("textScore", new BigDecimal("-0.00001")),
                Arguments.of("skillScore", new BigDecimal("1.00001"))
        );
    }

    private static Stream<Arguments> invalidStrategyTextScores() {
        return Stream.of(
                Arguments.of(RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, null),
                Arguments.of(RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, new BigDecimal("0.50000"))
        );
    }

    private PersistenceFixture fixture(String suffix) {
        Company company = createCompany(
                "candidate-ranking-" + suffix + "-company@example.test",
                "Candidate Ranking " + suffix + " Company",
                CompanyStatus.VERIFIED
        );
        Job job = createJob(company, "Candidate Ranking " + suffix + " Job", JobStatus.ACTIVE);
        ApplicationFixture applicationFixture = applicationFixture(job, suffix);
        return new PersistenceFixture(job, applicationFixture.application(), applicationFixture.cvFile());
    }

    private ApplicationFixture applicationFixture(Job job, String suffix) {
        Student student = createStudent("candidate-ranking-" + suffix + "-student@example.test");
        CvFile cvFile = createCv(student, "candidate-ranking-" + suffix + ".pdf", false);
        cvFile.setProcessingVersion("bilingual-nlp-v2-skills-v1");
        cvFile.setAnalyzedAt(LocalDateTime.of(2026, 8, 1, 10, 0));
        cvFileRepository.saveAndFlush(cvFile);
        JobApplication application = applicationRepository.saveAndFlush(JobApplication.builder()
                .student(student)
                .job(job)
                .cvFile(cvFile)
                .status(ApplicationStatus.PENDING)
                .build());
        return new ApplicationFixture(application, cvFile);
    }

    private CandidateRankingRun run(Job job, RecommendationRunStatus status, UUID requestId) {
        return CandidateRankingRun.builder()
                .job(job)
                .requestId(requestId)
                .status(status)
                .algorithm("tfidf-cosine-hybrid")
                .algorithmVersion("bilingual-candidate-ranking-v2")
                .threshold(new BigDecimal("0.10000"))
                .requestedLimit(20)
                .totalApplicationsScanned(4)
                .eligibleCandidates(1)
                .skippedNoCv(1)
                .skippedNotReady(1)
                .skippedTerminalStatus(1)
                .inputFingerprint("a".repeat(64))
                .jobUpdatedAtSnapshot(job.getUpdatedAt())
                .build();
    }

    private CandidateRankingResult result(
            CandidateRankingRun run,
            JobApplication application,
            CvFile cvFile,
            int rankPosition,
            RecommendationScoringStrategy strategy
    ) {
        return CandidateRankingResult.builder()
                .run(run)
                .application(application)
                .cvFile(cvFile)
                .score(new BigDecimal("0.72000"))
                .textScore(strategy == RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
                        ? new BigDecimal("0.65000")
                        : null)
                .skillScore(new BigDecimal("0.85000"))
                .scoringStrategy(strategy)
                .matchedSkills(List.of("java", "spring boot"))
                .missingSkills(List.of("docker"))
                .reason("Matched 2 of 3 declared job skills")
                .rankPosition(rankPosition)
                .cvProcessingVersion(cvFile.getProcessingVersion())
                .cvAnalyzedAtSnapshot(cvFile.getAnalyzedAt())
                .build();
    }

    private record ApplicationFixture(JobApplication application, CvFile cvFile) {
    }

    private record PersistenceFixture(Job job, JobApplication application, CvFile cvFile) {
    }
}
