package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingRequest;

import java.util.UUID;

public record CandidateRankingGenerationContext(
        Long runId,
        Long companyId,
        Long jobId,
        UUID requestId,
        AiCandidateRankingRequest aiRequest,
        CandidateRankingPreparationResult preparationResult
) {
}
