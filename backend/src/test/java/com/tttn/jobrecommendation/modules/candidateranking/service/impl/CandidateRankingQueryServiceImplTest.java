package com.tttn.jobrecommendation.modules.candidateranking.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingResultResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunResponse;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.mapper.CandidateRankingMapper;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultCountProjection;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateRankingQueryServiceImplTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private CandidateRankingRunRepository runRepository;

    @Mock
    private CandidateRankingResultRepository resultRepository;

    @Mock
    private CandidateRankingMapper mapper;

    @InjectMocks
    private CandidateRankingQueryServiceImpl queryService;

    @Test
    void listChecksOwnershipFirstAndEmptyPageSkipsAggregateQuery() {
        Job job = Job.builder().id(11L).build();
        PageRequest pageable = PageRequest.of(0, 20);
        when(jobRepository.findByIdAndCompanyId(11L, 7L)).thenReturn(Optional.of(job));
        when(runRepository.findByJobIdOrderByCreatedAtDescIdDesc(11L, pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        PageResponse<CandidateRankingRunResponse> response = queryService.getRuns(7L, 11L, 1, 20);

        assertThat(response.getItems()).isEmpty();
        assertThat(response.getPage()).isEqualTo(1);
        assertThat(response.getSize()).isEqualTo(20);
        assertThat(response.getTotalItems()).isZero();
        verify(resultRepository, never()).countResultsByRunIds(org.mockito.ArgumentMatchers.any());
        InOrder order = inOrder(jobRepository, runRepository);
        order.verify(jobRepository).findByIdAndCompanyId(11L, 7L);
        order.verify(runRepository).findByJobIdOrderByCreatedAtDescIdDesc(11L, pageable);
    }

    @Test
    void listUsesOneAggregateAndDefaultsMissingCountsToZero() {
        CandidateRankingRun first = CandidateRankingRun.builder().id(31L).build();
        CandidateRankingRun second = CandidateRankingRun.builder().id(32L).build();
        PageRequest pageable = PageRequest.of(1, 2);
        CandidateRankingResultCountProjection count = org.mockito.Mockito.mock(
                CandidateRankingResultCountProjection.class
        );
        CandidateRankingRunResponse firstResponse = org.mockito.Mockito.mock(CandidateRankingRunResponse.class);
        CandidateRankingRunResponse secondResponse = org.mockito.Mockito.mock(CandidateRankingRunResponse.class);
        when(jobRepository.findByIdAndCompanyId(11L, 7L)).thenReturn(Optional.of(Job.builder().id(11L).build()));
        when(runRepository.findByJobIdOrderByCreatedAtDescIdDesc(11L, pageable))
                .thenReturn(new PageImpl<>(List.of(first, second), pageable, 5));
        when(resultRepository.countResultsByRunIds(List.of(31L, 32L))).thenReturn(List.of(count));
        when(count.getRunId()).thenReturn(31L);
        when(count.getTotalRanked()).thenReturn(4L);
        when(mapper.toRunResponse(first, 4)).thenReturn(firstResponse);
        when(mapper.toRunResponse(second, 0)).thenReturn(secondResponse);

        PageResponse<CandidateRankingRunResponse> response = queryService.getRuns(7L, 11L, 2, 2);

        assertThat(response.getItems()).containsExactly(firstResponse, secondResponse);
        assertThat(response.getPage()).isEqualTo(2);
        assertThat(response.getTotalItems()).isEqualTo(5);
        verify(resultRepository).countResultsByRunIds(List.of(31L, 32L));
    }

    @Test
    void detailChecksOwnershipBeforeRunAndPreservesRepositoryRankOrder() {
        CandidateRankingRun run = CandidateRankingRun.builder().id(31L).build();
        CandidateRankingResult rankOne = CandidateRankingResult.builder().id(41L).rankPosition(1).build();
        CandidateRankingResult rankTwo = CandidateRankingResult.builder().id(42L).rankPosition(2).build();
        CandidateRankingResultResponse responseOne = org.mockito.Mockito.mock(CandidateRankingResultResponse.class);
        CandidateRankingResultResponse responseTwo = org.mockito.Mockito.mock(CandidateRankingResultResponse.class);
        when(jobRepository.findByIdAndCompanyId(11L, 7L)).thenReturn(Optional.of(Job.builder().id(11L).build()));
        when(runRepository.findByIdAndJobId(31L, 11L)).thenReturn(Optional.of(run));
        when(resultRepository.findByRunIdOrderByRankPositionAsc(31L)).thenReturn(List.of(rankOne, rankTwo));
        when(mapper.toResultResponse(rankOne)).thenReturn(responseOne);
        when(mapper.toResultResponse(rankTwo)).thenReturn(responseTwo);

        queryService.getRunDetail(7L, 11L, 31L);

        InOrder ownershipOrder = inOrder(jobRepository, runRepository);
        ownershipOrder.verify(jobRepository).findByIdAndCompanyId(11L, 7L);
        ownershipOrder.verify(runRepository).findByIdAndJobId(31L, 11L);
        verify(mapper).toRunDetailResponse(run, List.of(responseOne, responseTwo));
    }

    @Test
    void foreignAndMissingRunUseTheSameNotFoundError() {
        when(jobRepository.findByIdAndCompanyId(11L, 7L)).thenReturn(Optional.of(Job.builder().id(11L).build()));
        when(runRepository.findByIdAndJobId(31L, 11L)).thenReturn(Optional.empty());
        when(runRepository.findByIdAndJobId(999L, 11L)).thenReturn(Optional.empty());

        assertRunNotFound(31L);
        assertRunNotFound(999L);
    }

    @Test
    void missingOwnedJobStopsBeforeRunLookup() {
        when(jobRepository.findByIdAndCompanyId(11L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> queryService.getRunDetail(7L, 11L, 31L))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
        verify(runRepository, never()).findByIdAndJobId(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    private void assertRunNotFound(Long runId) {
        assertThatThrownBy(() -> queryService.getRunDetail(7L, 11L, runId))
                .isInstanceOfSatisfying(AppException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.CANDIDATE_RANKING_RUN_NOT_FOUND);
                    assertThat(exception.getMessage()).isEqualTo("Candidate ranking run not found");
                });
    }
}
