package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
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
    private final StudentSkillRepository studentSkillRepository;
    private final JobRepository jobRepository;
    private final RecommendationRunRepository recommendationRunRepository;
    private final RecommendationResultRepository recommendationResultRepository;
    private final EligibleJobCorpusBuilder eligibleJobCorpusBuilder;
    private final AiRecommendationRequestMapper requestMapper;
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
        if (!StringUtils.hasText(cvFile.getProcessedText())) {
            throw new AppException(ErrorCode.CV_ANALYSIS_NOT_READY);
        }

        List<String> normalizedStudentSkills = studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId())
                .stream()
                .map(StudentSkill::getSkill)
                .map(skill -> StringUtils.hasText(skill.getNormalizedName())
                        ? skill.getNormalizedName()
                        : skill.getName())
                .map(SkillNameNormalizer::normalize)
                .filter(StringUtils::hasText)
                .distinct()
                .sorted()
                .toList();
        List<AiRecommendationRequest.JobInput> jobs = eligibleJobCorpusBuilder.build(LocalDate.now());
        UUID requestId = UUID.randomUUID();
        AiRecommendationRequest aiRequest = requestMapper.toRequest(
                requestId,
                cvFile.getId(),
                cvFile.getProcessedText().strip(),
                normalizedStudentSkills,
                jobs,
                generationRequest.getThreshold(),
                generationRequest.getLimit()
        );

        RecommendationRun run = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.PROCESSING)
                .build());
        Set<Long> eligibleJobIds = jobs.stream()
                .map(AiRecommendationRequest.JobInput::id)
                .collect(Collectors.toUnmodifiableSet());
        return new RecommendationGenerationContext(run.getId(), aiRequest, eligibleJobIds);
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
                        .matchedKeywords(result.matchedSkills())
                        .rankPosition(result.rank())
                        .build())
                .toList();
        recommendationResultRepository.saveAllAndFlush(results);

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
