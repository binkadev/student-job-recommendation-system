package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;

import java.util.List;
import java.util.Map;

record RecommendationGenerationV3Context(
        Long runId,
        AiRecommendationV3Request request,
        Map<Long, List<String>> jobSkillsById,
        List<String> cvCanonicalSkills
) {
}
