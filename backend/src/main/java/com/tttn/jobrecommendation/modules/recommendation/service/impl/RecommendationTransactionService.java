package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecommendationTransactionService {

    private final StudentRepository studentRepository;
    private final CvFileRepository cvFileRepository;
    private final JobRepository jobRepository;
    private final RecommendationRunRepository recommendationRunRepository;
    private final RecommendationResultRepository recommendationResultRepository;
    private final EligibleJobCorpusBuilder eligibleJobCorpusBuilder;
    private final AiRecommendationRequestMapper requestMapper;
    private final EligibleJobCorpusV3Builder eligibleJobCorpusV3Builder;
    private final AiRecommendationV3RequestMapper v3RequestMapper;
    private final SkillCatalogCanonicalizer skillCatalogCanonicalizer;
    private final RecommendationFailureMessageSanitizer failureMessageSanitizer;

    @Transactional
    public RecommendationGenerationContext createProcessingRun(
            Long userId,
            GenerateRecommendationRequest generationRequest
    ) {
        Student student = studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
        CvFile cvFile = cvFileRepository.findByIdAndStudentId(generationRequest.getCvId(), student.getId())
                .orElseThrow(() -> new ResourceNotFoundException("CV file not found"));
        if (cvFile.getAnalysisStatus() != CvAnalysisStatus.READY
                || !StringUtils.hasText(cvFile.getExtractedText())
                || !StringUtils.hasText(cvFile.getProcessedText())) {
            throw new AppException(ErrorCode.CV_ANALYSIS_NOT_READY);
        }

        List<String> extractedSkills = cvFile.getExtractedSkills() == null
                ? List.of()
                : List.copyOf(cvFile.getExtractedSkills());
        List<AiRecommendationRequest.JobInput> jobs = eligibleJobCorpusBuilder.build(LocalDate.now());
        UUID requestId = UUID.randomUUID();
        AiRecommendationRequest aiRequest = requestMapper.toRequest(
                requestId,
                cvFile.getId(),
                cvFile.getExtractedText(),
                extractedSkills,
                jobs,
                generationRequest.getThreshold(),
                generationRequest.getLimit()
        );

        RecommendationRun run = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.PROCESSING)
                .totalJobsScanned(jobs.size())
                .build());
        Set<Long> eligibleJobIds = jobs.stream()
                .map(AiRecommendationRequest.JobInput::id)
                .collect(Collectors.toUnmodifiableSet());
        return new RecommendationGenerationContext(run.getId(), aiRequest, eligibleJobIds);
    }

    @Transactional
    public RecommendationGenerationV3Context createProcessingRunV3(
            Long userId,
            GenerateRecommendationRequest generationRequest
    ) {
        Student student = studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
        CvFile cvFile = cvFileRepository.findByIdAndStudentId(generationRequest.getCvId(), student.getId())
                .orElseThrow(() -> new ResourceNotFoundException("CV file not found"));
        if (cvFile.getAnalysisStatus() != CvAnalysisStatus.READY
                || !StringUtils.hasText(cvFile.getProcessedText())
                || !StringUtils.hasText(cvFile.getLanguageCode())
                || cvFile.getLanguageConfidence() == null
                || cvFile.getLanguageConfidence().compareTo(java.math.BigDecimal.ZERO) < 0
                || cvFile.getLanguageConfidence().compareTo(java.math.BigDecimal.ONE) > 0
                || !RecommendationV3Contract.PROCESSING_VERSION.equals(cvFile.getProcessingVersion())) {
            throw new AppException(ErrorCode.CV_ANALYSIS_NOT_READY);
        }
        List<String> cvSkills = skillCatalogCanonicalizer.canonicalizeAllSorted(
                cvFile.getExtractedSkills() == null ? List.of() : cvFile.getExtractedSkills()
        );
        List<AiRecommendationV3Request.JobInput> jobs = eligibleJobCorpusV3Builder.build(LocalDate.now());
        UUID requestId = UUID.randomUUID();
        AiRecommendationV3Request request = v3RequestMapper.toRequest(
                requestId, cvFile.getId(), cvFile.getProcessedText(), cvSkills, cvFile.getLanguageCode(),
                cvFile.getLanguageConfidence(), cvFile.getProcessingVersion(), jobs,
                generationRequest.getThreshold(), generationRequest.getLimit()
        );
        RecommendationRun run = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student).cvFile(cvFile).sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.PROCESSING).totalJobsScanned(jobs.size()).build());
        Map<Long, List<String>> jobSkillsById = jobs.stream().collect(Collectors.toUnmodifiableMap(
                AiRecommendationV3Request.JobInput::id, AiRecommendationV3Request.JobInput::skills
        ));
        return new RecommendationGenerationV3Context(run.getId(), request, jobSkillsById, cvSkills);
    }

    @Transactional
    public void completeSuccess(Long runId, ValidatedRecommendationResponse validatedResponse) {
        RecommendationRun run = getProcessingRun(runId);
        Set<Long> jobIds = validatedResponse.results().stream()
                .map(ValidatedRecommendationResponse.Result::jobId)
                .collect(Collectors.toSet());
        Map<Long, Job> jobsById = new HashMap<>();
        jobRepository.findAllById(jobIds).forEach(job -> jobsById.put(job.getId(), job));
        if (jobsById.size() != jobIds.size()) {
            throw new AppException(ErrorCode.RECOMMENDATION_GENERATION_FAILED);
        }

        List<RecommendationResult> results = validatedResponse.results().stream()
                .map(result -> RecommendationResult.builder()
                        .run(run)
                        .job(jobsById.get(result.jobId()))
                        .score(result.score())
                        .textScore(result.textScore())
                        .skillScore(result.skillScore())
                        .scoringStrategy(result.scoringStrategy())
                        .matchedKeywords(result.matchedSkills())
                        .missingSkills(result.missingSkills())
                        .reason(result.reason())
                        .rankPosition(result.rankPosition())
                        .build())
                .toList();
        recommendationResultRepository.saveAllAndFlush(results);

        run.setAlgorithm(validatedResponse.algorithm());
        run.setAlgorithmVersion(validatedResponse.algorithmVersion());
        run.setStatus(RecommendationRunStatus.SUCCESS);
        run.setFinishedAt(LocalDateTime.now());
        run.setErrorMessage(null);
        recommendationRunRepository.save(run);
    }

    @Transactional
    public void completeSuccessV3(Long runId, ValidatedRecommendationV3Response validatedResponse) {
        RecommendationRun run = getProcessingRun(runId);
        Set<Long> jobIds = validatedResponse.results().stream()
                .map(ValidatedRecommendationV3Response.Result::jobId).collect(Collectors.toSet());
        Map<Long, Job> jobsById = new HashMap<>();
        jobRepository.findAllById(jobIds).forEach(job -> jobsById.put(job.getId(), job));
        if (jobsById.size() != jobIds.size()) {
            throw new AppException(ErrorCode.RECOMMENDATION_GENERATION_FAILED);
        }
        List<RecommendationResult> results = validatedResponse.results().stream().map(result ->
                RecommendationResult.builder().run(run).job(jobsById.get(result.jobId()))
                        .rankingScore(result.rankingScore()).overallScore(result.overallScore())
                        .textScore(result.textScore()).skillScore(result.skillScore())
                        .rankingTier(result.rankingTier()).scoringStrategy(result.scoringStrategy())
                        .matchedKeywords(result.matchedSkills()).missingSkills(result.missingSkills())
                        .reason(result.reason()).rankPosition(result.rankPosition())
                        .tierRankPosition(result.tierRankPosition()).build()).toList();
        recommendationResultRepository.saveAllAndFlush(results);
        run.setAlgorithm(validatedResponse.algorithm());
        run.setAlgorithmVersion(validatedResponse.algorithmVersion());
        run.setStatus(RecommendationRunStatus.SUCCESS);
        run.setFinishedAt(LocalDateTime.now());
        run.setErrorMessage(null);
        recommendationRunRepository.save(run);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long runId, Throwable throwable) {
        recommendationRunRepository.findById(runId).ifPresent(run -> {
            if (run.getStatus() == RecommendationRunStatus.PROCESSING) {
                run.setStatus(RecommendationRunStatus.FAILED);
                run.setFinishedAt(LocalDateTime.now());
                run.setErrorMessage(failureMessageSanitizer.sanitize(throwable));
                recommendationRunRepository.save(run);
            }
        });
    }

    private RecommendationRun getProcessingRun(Long runId) {
        RecommendationRun run = recommendationRunRepository.findById(runId)
                .orElseThrow(() -> new AppException(ErrorCode.RECOMMENDATION_GENERATION_FAILED));
        if (run.getStatus() != RecommendationRunStatus.PROCESSING) {
            throw new AppException(ErrorCode.RECOMMENDATION_GENERATION_FAILED);
        }
        return run;
    }
}
