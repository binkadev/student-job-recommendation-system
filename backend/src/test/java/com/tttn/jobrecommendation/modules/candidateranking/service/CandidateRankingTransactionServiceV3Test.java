package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingJobSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingV3PreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingV3Response;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateRankingTransactionServiceV3Test {
    private static final long COMPANY = 1L, JOB = 2L, RUN = 3L, APPLICATION = 4L, CV = 5L, APPLICATION_TWO = 6L, CV_TWO = 7L;

    @Test
    void v3RunUsesSeparateRequestedLimitsAndNullLegacyLimit() {
        Fixture f = fixture(); CandidateRankingV3PreparationResult preparation = preparation("baseline");
        when(f.corpus.prepareV3(COMPANY, JOB)).thenReturn(preparation);
        when(f.runs.findFirstByJobIdAndStatusOrderByCreatedAtDescIdDesc(JOB, RecommendationRunStatus.PROCESSING)).thenReturn(Optional.empty());
        when(f.jobs.getReferenceById(JOB)).thenReturn(job());
        when(f.runs.saveAndFlush(any(CandidateRankingRun.class))).thenAnswer(i -> { CandidateRankingRun run = i.getArgument(0); run.setId(RUN); return run; });

        var context = f.service.createProcessingRunV3(COMPANY, JOB, new BigDecimal("0.10"), 20, 15);

        ArgumentCaptor<CandidateRankingRun> run = ArgumentCaptor.forClass(CandidateRankingRun.class);
        verify(f.runs).saveAndFlush(run.capture());
        assertThat(context.aiRequest().primaryLimit()).isEqualTo(20);
        assertThat(context.aiRequest().fallbackLimit()).isEqualTo(15);
        assertThat(run.getValue().getRequestedLimit()).isNull();
        assertThat(run.getValue().getRequestedPrimaryLimit()).isEqualTo(20);
        assertThat(run.getValue().getRequestedFallbackLimit()).isEqualTo(15);
        assertThat(run.getValue().getStatus()).isEqualTo(RecommendationRunStatus.PROCESSING);
        assertThat(run.getValue().getInputFingerprint()).isEqualTo(preparation.inputFingerprint());
        assertThat(run.getValue().getTotalApplicationsScanned()).isEqualTo(preparation.counters().totalApplicationsScanned());
        assertThat(run.getValue().getEligibleCandidates()).isEqualTo(preparation.counters().eligibleCandidates());
        assertThat(run.getValue().getSkippedNoCv()).isEqualTo(preparation.counters().skippedNoCv());
        assertThat(run.getValue().getSkippedNotReady()).isEqualTo(preparation.counters().skippedNotReady());
        assertThat(run.getValue().getSkippedTerminalStatus()).isEqualTo(preparation.counters().skippedTerminalStatus());
    }

    @Test
    void completeV3PersistsValidatedTierFieldsAndRejectsFingerprintDriftBeforeResults() {
        Fixture f = fixture(); CandidateRankingV3PreparationResult preparation = preparation("baseline");
        CandidateRankingRun run = CandidateRankingRun.builder().id(RUN).job(job()).status(RecommendationRunStatus.PROCESSING).inputFingerprint(preparation.inputFingerprint()).build();
        when(f.runs.findByIdForUpdate(RUN)).thenReturn(Optional.of(run));
        when(f.corpus.prepareV3(COMPANY, JOB)).thenReturn(preparation);
        CvFile cv = CvFile.builder().id(CV).build(); CvFile cvTwo = CvFile.builder().id(CV_TWO).build();
        when(f.applications.findCandidateRankingApplicationsByIdIn(java.util.Set.of(APPLICATION, APPLICATION_TWO))).thenReturn(List.of(JobApplication.builder().id(APPLICATION).job(job()).cvFile(cv).build(), JobApplication.builder().id(APPLICATION_TWO).job(job()).cvFile(cvTwo).build()));
        ValidatedCandidateRankingV3Response response = new ValidatedCandidateRankingV3Response("tfidf-cosine-hybrid", "bilingual-candidate-ranking-v3", List.of(
                result(APPLICATION, CV, RecommendationRankingTier.PRIMARY, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, new BigDecimal("0.70"), new BigDecimal("0.70"), new BigDecimal("0.80"), 1, 1),
                result(APPLICATION_TWO, CV_TWO, RecommendationRankingTier.FALLBACK, RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, new BigDecimal("0.50"), null, null, 2, 1)
        ));

        f.service.completeSuccessV3(RUN, COMPANY, JOB, response);

        ArgumentCaptor<List<CandidateRankingResult>> persisted = ArgumentCaptor.forClass(List.class);
        verify(f.results).saveAllAndFlush(persisted.capture());
        assertThat(persisted.getValue()).extracting(CandidateRankingResult::getRankingTier).containsExactly(RecommendationRankingTier.PRIMARY, RecommendationRankingTier.FALLBACK);
        assertThat(persisted.getValue().get(0).getRankingScore()).isEqualByComparingTo("0.70");
        assertThat(persisted.getValue().get(1).getOverallScore()).isNull();
        assertThat(persisted.getValue().get(1).getTextScore()).isNull();
        assertThat(persisted.getValue()).extracting(CandidateRankingResult::getTierRankPosition).containsExactly(1, 1);
        assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(run.getAlgorithmVersion()).isEqualTo("bilingual-candidate-ranking-v3");

        Fixture drift = fixture(); CandidateRankingRun stale = CandidateRankingRun.builder().id(RUN).job(job()).status(RecommendationRunStatus.PROCESSING).inputFingerprint(preparation.inputFingerprint()).build();
        when(drift.runs.findByIdForUpdate(RUN)).thenReturn(Optional.of(stale));
        when(drift.corpus.prepareV3(COMPANY, JOB)).thenReturn(preparation("changed"));
        assertThatThrownBy(() -> drift.service.completeSuccessV3(RUN, COMPANY, JOB, response)).isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED));
        verify(drift.results, never()).saveAllAndFlush(any());
    }

    private ValidatedCandidateRankingV3Response.Result result(long application, long cv, RecommendationRankingTier tier, RecommendationScoringStrategy strategy, BigDecimal ranking, BigDecimal overall, BigDecimal text, int rank, int tierRank) {
        return new ValidatedCandidateRankingV3Response.Result(application, cv, tier, ranking, overall, text, new BigDecimal("0.50"), strategy, List.of("java"), List.of("spring"), "reason", rank, tierRank, "bilingual-nlp-v2-skills-v1", LocalDateTime.of(2026, 1, 1, 0, 0));
    }
    private CandidateRankingV3PreparationResult preparation(String processedText) {
        CandidateRankingJobSnapshot job = new CandidateRankingJobSnapshot(JOB, "Backend", "Build", "Java", List.of("java", "spring"), LocalDateTime.of(2026, 1, 1, 1, 0));
        CandidateRankingCandidateSnapshot candidate = new CandidateRankingCandidateSnapshot(APPLICATION, ApplicationStatus.PENDING, CV, "ignored", processedText, List.of("java"), CvAnalysisStatus.READY, "en", BigDecimal.ONE, "bilingual-nlp-v2-skills-v1", LocalDateTime.of(2026, 1, 1, 0, 0));
        CandidateRankingCandidateSnapshot candidateTwo = new CandidateRankingCandidateSnapshot(APPLICATION_TWO, ApplicationStatus.REVIEWED, CV_TWO, "ignored", "processed two", List.of("java"), CvAnalysisStatus.READY, "en", BigDecimal.ONE, "bilingual-nlp-v2-skills-v1", LocalDateTime.of(2026, 1, 1, 0, 0));
        AiCandidateRankingV3Request.JobInput input = new AiCandidateRankingV3Request.JobInput(JOB, "Backend Build Java", List.of("java", "spring"));
        return new CandidateRankingV3PreparationResult(job, input, List.of(candidate, candidateTwo), List.of(new AiCandidateRankingV3Request.CandidateInput(APPLICATION, CV, processedText, List.of("java"), "en", BigDecimal.ONE, "bilingual-nlp-v2-skills-v1"), new AiCandidateRankingV3Request.CandidateInput(APPLICATION_TWO, CV_TWO, "processed two", List.of("java"), "en", BigDecimal.ONE, "bilingual-nlp-v2-skills-v1")), new CandidateRankingCorpusCounters(2, 2, 0, 0, 0), CandidateRankingInputFingerprint.computeV3(job, List.of(candidate, candidateTwo)));
    }
    private Job job() { return Job.builder().id(JOB).build(); }
    private Fixture fixture() { CandidateRankingCorpusPreparationService corpus=mock(CandidateRankingCorpusPreparationService.class); CandidateRankingRunRepository runs=mock(CandidateRankingRunRepository.class); CandidateRankingResultRepository results=mock(CandidateRankingResultRepository.class); JobApplicationRepository applications=mock(JobApplicationRepository.class); JobRepository jobs=mock(JobRepository.class); return new Fixture(new CandidateRankingTransactionService(corpus,runs,results,applications,jobs,mock(CandidateRankingFailureMessageSanitizer.class)),corpus,runs,results,applications,jobs); }
    private record Fixture(CandidateRankingTransactionService service, CandidateRankingCorpusPreparationService corpus, CandidateRankingRunRepository runs, CandidateRankingResultRepository results, JobApplicationRepository applications, JobRepository jobs) {}
}
