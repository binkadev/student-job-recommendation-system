package com.tttn.jobrecommendation.modules.candidateranking.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingResultResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunResponse;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.mapper.CandidateRankingMapper;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultCountProjection;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.candidateranking.service.CandidateRankingQueryService;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CandidateRankingQueryServiceImpl implements CandidateRankingQueryService {

    private final JobRepository jobRepository;
    private final CandidateRankingRunRepository runRepository;
    private final CandidateRankingResultRepository resultRepository;
    private final CandidateRankingMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CandidateRankingRunResponse> getRuns(
            Long companyId,
            Long jobId,
            int page,
            int size
    ) {
        requireOwnedJob(companyId, jobId);
        Page<CandidateRankingRun> runs = runRepository.findByJobIdOrderByCreatedAtDescIdDesc(
                jobId,
                PageRequest.of(page - 1, size)
        );
        Map<Long, Integer> totalRankedByRunId = getTotalRankedByRunId(runs.getContent());
        List<CandidateRankingRunResponse> items = runs.getContent().stream()
                .map(run -> mapper.toRunResponse(
                        run,
                        totalRankedByRunId.getOrDefault(run.getId(), 0)
                ))
                .toList();
        return new PageResponse<>(
                items,
                runs.getNumber() + 1,
                runs.getSize(),
                runs.getTotalElements(),
                runs.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public CandidateRankingRunDetailResponse getRunDetail(
            Long companyId,
            Long jobId,
            Long runId
    ) {
        requireOwnedJob(companyId, jobId);
        CandidateRankingRun run = runRepository.findByIdAndJobId(runId, jobId)
                .orElseThrow(() -> new AppException(ErrorCode.CANDIDATE_RANKING_RUN_NOT_FOUND));
        List<CandidateRankingResultResponse> results = resultRepository
                .findByRunIdOrderByRankPositionAsc(runId)
                .stream()
                .map(mapper::toResultResponse)
                .toList();
        return mapper.toRunDetailResponse(run, results);
    }

    private void requireOwnedJob(Long companyId, Long jobId) {
        jobRepository.findByIdAndCompanyId(jobId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }

    private Map<Long, Integer> getTotalRankedByRunId(List<CandidateRankingRun> runs) {
        if (runs.isEmpty()) {
            return Map.of();
        }
        List<Long> runIds = runs.stream().map(CandidateRankingRun::getId).toList();
        Map<Long, Integer> counts = new HashMap<>();
        for (CandidateRankingResultCountProjection projection
                : resultRepository.countResultsByRunIds(runIds)) {
            Long count = projection.getTotalRanked();
            counts.put(projection.getRunId(), count == null ? 0 : Math.toIntExact(count));
        }
        return Map.copyOf(counts);
    }
}
