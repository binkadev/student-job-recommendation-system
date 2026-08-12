package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.mapper.RecommendationMapper;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationQueryServiceImplTest {
    @Mock private RecommendationRunRepository runs;
    @Mock private RecommendationResultRepository results;
    @Mock private StudentRepository students;
    @Mock private RecommendationMapper mapper;
    @InjectMocks private RecommendationQueryServiceImpl service;

    @Test
    void latestResultsUsePersistedGlobalRankOrderAndDelegateDirectMapping() {
        Student student = Student.builder().id(2L).build();
        RecommendationRun run = RecommendationRun.builder().id(3L).build();
        RecommendationResult first = RecommendationResult.builder().id(4L).rankPosition(1).build();
        RecommendationResult second = RecommendationResult.builder().id(5L).rankPosition(2).build();
        RecommendationResultResponse firstResponse = org.mockito.Mockito.mock(RecommendationResultResponse.class);
        RecommendationResultResponse secondResponse = org.mockito.Mockito.mock(RecommendationResultResponse.class);
        when(students.findByUserId(1L)).thenReturn(Optional.of(student));
        when(runs.findFirstByStudentIdAndStatusOrderByCreatedAtDescIdDesc(2L, RecommendationRunStatus.SUCCESS)).thenReturn(Optional.of(run));
        when(results.findByRunIdOrderByRankPositionAsc(3L)).thenReturn(List.of(first, second));
        when(mapper.toRecommendationResultResponse(first)).thenReturn(firstResponse);
        when(mapper.toRecommendationResultResponse(second)).thenReturn(secondResponse);

        assertThat(service.getLatestRecommendationResults(1L)).containsExactly(firstResponse, secondResponse);
        InOrder order = inOrder(results, mapper);
        order.verify(results).findByRunIdOrderByRankPositionAsc(3L);
        order.verify(mapper).toRecommendationResultResponse(first);
        order.verify(mapper).toRecommendationResultResponse(second);
    }
}
