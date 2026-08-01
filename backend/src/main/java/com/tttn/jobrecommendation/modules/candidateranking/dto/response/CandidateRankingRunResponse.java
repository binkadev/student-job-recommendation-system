package com.tttn.jobrecommendation.modules.candidateranking.dto.response;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CandidateRankingRunResponse(
        Long id,
        Long jobId,
        String jobTitle,
        RecommendationRunStatus status,
        String algorithm,
        String algorithmVersion,
        BigDecimal threshold,
        Integer requestedLimit,
        Integer totalApplicationsScanned,
        Integer eligibleCandidates,
        Integer skippedNoCv,
        Integer skippedNotReady,
        Integer skippedTerminalStatus,
        Integer totalRanked,
        String errorMessage,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        LocalDateTime createdAt
) {
}
