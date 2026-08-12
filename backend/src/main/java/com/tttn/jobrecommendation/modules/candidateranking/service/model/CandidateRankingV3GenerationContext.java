package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingV3Request;

import java.util.UUID;

public record CandidateRankingV3GenerationContext(
        Long runId,
        Long companyId,
        Long jobId,
        UUID requestId,
        AiCandidateRankingV3Request aiRequest,
        CandidateRankingV3PreparationResult preparationResult
) {
}
