package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;

import java.util.List;
import java.util.UUID;

public record AiRecommendationResponse(
        UUID requestId,
        String algorithm,
        String algorithmVersion,
        List<Result> results
) {

    public record Result(
            Long jobId,
            Double score,
            Double textScore,
            Double skillScore,
            RecommendationScoringStrategy scoringStrategy,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason
    ) {
    }
}
