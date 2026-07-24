package com.tttn.jobrecommendation.infrastructure.ai.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record AiRecommendationRequest(
        UUID requestId,
        CvInput cv,
        List<JobInput> jobs,
        BigDecimal threshold,
        Integer limit
) {

    public record CvInput(
            Long id,
            String processedText,
            List<String> skills
    ) {
    }

    public record JobInput(
            Long id,
            String processedText,
            List<String> skills
    ) {
    }
}
