package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunResponse;

public interface CandidateRankingQueryService {

    PageResponse<CandidateRankingRunResponse> getRuns(
            Long companyId,
            Long jobId,
            int page,
            int size
    );

    CandidateRankingRunDetailResponse getRunDetail(Long companyId, Long jobId, Long runId);
}
