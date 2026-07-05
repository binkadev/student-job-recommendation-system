package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunResponse;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.mapper.RecommendationMapper;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationQueryService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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
        return recommendationRunRepository.findByStudentIdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(run -> recommendationMapper.toRecommendationRunResponse(
                        run,
                        recommendationResultRepository.countByRunId(run.getId())
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationResultResponse> getLatestRecommendationResults(Long userId) {
        Student student = getStudentByUserId(userId);
        return recommendationRunRepository.findFirstByStudentIdOrderByCreatedAtDesc(student.getId())
                .map(this::getResultsByRun)
                .orElse(List.of());
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
}
