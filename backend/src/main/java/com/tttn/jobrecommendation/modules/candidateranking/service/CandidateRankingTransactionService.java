package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCorpusCounters;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingGenerationContext;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingResponse;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CandidateRankingTransactionService {

    static final String PROCESSING_UNIQUE_CONSTRAINT = "uk_candidate_ranking_runs_job_processing";

    private final CandidateRankingCorpusPreparationService corpusPreparationService;
    private final CandidateRankingRunRepository runRepository;
    private final CandidateRankingResultRepository resultRepository;
    private final JobApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final CandidateRankingFailureMessageSanitizer failureMessageSanitizer;

    @Transactional
    public CandidateRankingGenerationContext createProcessingRun(
            Long companyId,
            Long jobId,
            java.math.BigDecimal threshold,
            int requestedLimit
    ) {
        CandidateRankingPreparationResult preparation = corpusPreparationService.prepare(companyId, jobId);
        if (runRepository.findFirstByJobIdAndStatusOrderByCreatedAtDescIdDesc(
                jobId,
                RecommendationRunStatus.PROCESSING
        ).isPresent()) {
            throw alreadyProcessing();
        }

        UUID requestId = UUID.randomUUID();
        AiCandidateRankingRequest aiRequest = new AiCandidateRankingRequest(
                requestId,
                preparation.aiJobInput(),
                preparation.aiCandidateInputs(),
                threshold,
                requestedLimit
        );
        CandidateRankingCorpusCounters counters = preparation.counters();
        CandidateRankingRun run = CandidateRankingRun.builder()
                .job(jobRepository.getReferenceById(jobId))
                .requestId(requestId)
                .status(RecommendationRunStatus.PROCESSING)
                .threshold(threshold)
                .requestedLimit(requestedLimit)
                .totalApplicationsScanned(counters.totalApplicationsScanned())
                .eligibleCandidates(counters.eligibleCandidates())
                .skippedNoCv(counters.skippedNoCv())
                .skippedNotReady(counters.skippedNotReady())
                .skippedTerminalStatus(counters.skippedTerminalStatus())
                .inputFingerprint(preparation.inputFingerprint())
                .jobUpdatedAtSnapshot(preparation.jobSnapshot().updatedAt())
                .algorithm(null)
                .algorithmVersion(null)
                .finishedAt(null)
                .errorMessage(null)
                .build();

        try {
            runRepository.saveAndFlush(run);
        } catch (DataIntegrityViolationException exception) {
            if (hasConstraint(exception, PROCESSING_UNIQUE_CONSTRAINT)) {
                throw alreadyProcessing();
            }
            throw exception;
        }

        return new CandidateRankingGenerationContext(
                run.getId(),
                companyId,
                jobId,
                requestId,
                aiRequest,
                preparation
        );
    }

    @Transactional
    public void completeSuccess(
            Long runId,
            Long companyId,
            Long expectedJobId,
            ValidatedCandidateRankingResponse validatedResponse
    ) {
        CandidateRankingRun run = requireProcessingRun(runId, expectedJobId);
        CandidateRankingPreparationResult currentPreparation;
        try {
            currentPreparation = corpusPreparationService.prepare(companyId, expectedJobId);
        } catch (RuntimeException exception) {
            throw generationFailed();
        }
        if (!Objects.equals(run.getInputFingerprint(), currentPreparation.inputFingerprint())) {
            throw generationFailed();
        }

        Map<Long, CandidateRankingCandidateSnapshot> currentCandidates = currentPreparation
                .eligibleCandidateSnapshots()
                .stream()
                .collect(Collectors.toUnmodifiableMap(
                        CandidateRankingCandidateSnapshot::applicationId,
                        Function.identity()
                ));
        Set<Long> resultApplicationIds = validatedResponse.results().stream()
                .map(ValidatedCandidateRankingResponse.Result::applicationId)
                .collect(Collectors.toUnmodifiableSet());
        Map<Long, JobApplication> applicationsById = loadApplications(resultApplicationIds);

        List<CandidateRankingResult> results = validatedResponse.results().stream()
                .map(result -> toEntity(
                        run,
                        expectedJobId,
                        result,
                        currentCandidates,
                        applicationsById
                ))
                .toList();
        resultRepository.saveAllAndFlush(results);

        run.setAlgorithm(validatedResponse.algorithm());
        run.setAlgorithmVersion(validatedResponse.algorithmVersion());
        run.setStatus(RecommendationRunStatus.SUCCESS);
        run.setFinishedAt(LocalDateTime.now());
        run.setErrorMessage(null);
        runRepository.saveAndFlush(run);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long runId, Throwable throwable) {
        runRepository.findByIdForUpdate(runId).ifPresent(run -> {
            if (run.getStatus() == RecommendationRunStatus.PROCESSING) {
                run.setStatus(RecommendationRunStatus.FAILED);
                run.setFinishedAt(LocalDateTime.now());
                run.setErrorMessage(failureMessageSanitizer.sanitize(throwable));
                runRepository.saveAndFlush(run);
            }
        });
    }

    private CandidateRankingRun requireProcessingRun(Long runId, Long expectedJobId) {
        CandidateRankingRun run = runRepository.findByIdForUpdate(runId)
                .orElseThrow(this::generationFailed);
        if (run.getStatus() != RecommendationRunStatus.PROCESSING
                || !Objects.equals(run.getJob().getId(), expectedJobId)) {
            throw generationFailed();
        }
        return run;
    }

    private Map<Long, JobApplication> loadApplications(Set<Long> applicationIds) {
        if (applicationIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, JobApplication> applicationsById = new HashMap<>();
        for (JobApplication application
                : applicationRepository.findCandidateRankingApplicationsByIdIn(applicationIds)) {
            if (applicationsById.putIfAbsent(application.getId(), application) != null) {
                throw generationFailed();
            }
        }
        if (applicationsById.size() != applicationIds.size()) {
            throw generationFailed();
        }
        return Map.copyOf(applicationsById);
    }

    private CandidateRankingResult toEntity(
            CandidateRankingRun run,
            Long expectedJobId,
            ValidatedCandidateRankingResponse.Result result,
            Map<Long, CandidateRankingCandidateSnapshot> currentCandidates,
            Map<Long, JobApplication> applicationsById
    ) {
        CandidateRankingCandidateSnapshot currentCandidate = currentCandidates.get(result.applicationId());
        JobApplication application = applicationsById.get(result.applicationId());
        if (currentCandidate == null
                || application == null
                || application.getJob() == null
                || !Objects.equals(application.getJob().getId(), expectedJobId)
                || application.getCvFile() == null
                || !Objects.equals(application.getCvFile().getId(), currentCandidate.cvId())
                || !Objects.equals(result.cvId(), currentCandidate.cvId())) {
            throw generationFailed();
        }

        return CandidateRankingResult.builder()
                .run(run)
                .application(application)
                .cvFile(application.getCvFile())
                .score(result.score())
                .textScore(result.textScore())
                .skillScore(result.skillScore())
                .scoringStrategy(result.scoringStrategy())
                .matchedSkills(result.matchedSkills())
                .missingSkills(result.missingSkills())
                .reason(result.reason())
                .rankPosition(result.rankPosition())
                .cvProcessingVersion(currentCandidate.processingVersion())
                .cvAnalyzedAtSnapshot(currentCandidate.analyzedAt())
                .build();
    }

    private boolean hasConstraint(Throwable throwable, String constraintName) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof ConstraintViolationException constraintViolation
                    && constraintName.equals(constraintViolation.getConstraintName())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private AppException alreadyProcessing() {
        return new AppException(ErrorCode.CANDIDATE_RANKING_ALREADY_PROCESSING);
    }

    private AppException generationFailed() {
        return new AppException(ErrorCode.CANDIDATE_RANKING_GENERATION_FAILED);
    }
}
