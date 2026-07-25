package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;

import java.util.Set;

public record RecommendationGenerationContext(
        Long runId,
        AiRecommendationRequest request,
        Set<Long> eligibleJobIds
) {
}
