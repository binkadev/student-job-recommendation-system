package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunDetailResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunResponse;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.mapper.RecommendationMapper;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultCountProjection;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationQueryService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecommendationQueryServiceImpl implements RecommendationQueryService {

    private final RecommendationRunRepository recommendationRunRepository;
    private final RecommendationResultRepository recommendationResultRepository;
    private final StudentRepository studentRepository;
    private final RecommendationMapper recommendationMapper;

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationRunResponse> getMyRecommendationRuns(Long userId) {
        Student student = getStudentByUserId(userId);
        List<RecommendationRun> runs =
                recommendationRunRepository.findByStudentIdOrderByCreatedAtDesc(student.getId());
        if (runs.isEmpty()) {
            return List.of();
        }

        List<Long> runIds = runs.stream()
                .map(RecommendationRun::getId)
                .toList();
        Map<Long, Integer> totalRecommendedByRunId = new HashMap<>();
        recommendationResultRepository.countResultsByRunIds(runIds)
                .forEach(count -> totalRecommendedByRunId.put(
                        count.getRunId(),
                        toIntegerCount(count)
                ));

        return runs
                .stream()
                .map(run -> recommendationMapper.toRecommendationRunResponse(
                        run,
                        totalRecommendedByRunId.getOrDefault(run.getId(), 0)
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationResultResponse> getLatestRecommendationResults(Long userId) {
        Student student = getStudentByUserId(userId);
        return recommendationRunRepository.findFirstByStudentIdAndStatusOrderByCreatedAtDescIdDesc(
                        student.getId(),
                        RecommendationRunStatus.SUCCESS
                )
                .map(this::getResultsByRun)
                .orElse(List.of());
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationRunDetailResponse getMyRecommendationRun(Long userId, Long runId) {
        Student student = getStudentByUserId(userId);
        RecommendationRun run = recommendationRunRepository.findByIdAndStudentId(runId, student.getId())
                .orElseThrow(() -> new AppException(ErrorCode.RECOMMENDATION_RUN_NOT_FOUND));
        List<RecommendationResultResponse> results = getResultsByRun(run);
        return recommendationMapper.toRecommendationRunDetailResponse(run, results);
    }

    private List<RecommendationResultResponse> getResultsByRun(RecommendationRun run) {
        return recommendationResultRepository.findByRunIdOrderByRankPositionAsc(run.getId())
                .stream()
                .map(recommendationMapper::toRecommendationResultResponse)
                .toList();
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private int toIntegerCount(RecommendationResultCountProjection count) {
        Long totalRecommended = count.getTotalRecommended();
        return totalRecommended == null ? 0 : Math.toIntExact(totalRecommended);
    }
}
