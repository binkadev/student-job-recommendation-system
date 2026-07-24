package com.tttn.jobrecommendation.infrastructure.ai.dto;

import java.util.List;
import java.util.UUID;

public record AiRecommendationResponse(
        UUID requestId,
        String algorithmVersion,
        List<Result> results
) {

    public record Result(
            Long jobId,
            Double score,
            Integer rank,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason
    ) {
    }
}
