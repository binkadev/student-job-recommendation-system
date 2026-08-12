package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
class AiRecommendationV3RequestMapper {

    AiRecommendationV3Request toRequest(
            UUID requestId,
            Long cvId,
            String processedText,
            List<String> canonicalSkills,
            String languageCode,
            BigDecimal languageConfidence,
            String processingVersion,
            List<AiRecommendationV3Request.JobInput> jobs,
            BigDecimal threshold,
            Integer limit
    ) {
        return new AiRecommendationV3Request(
                requestId,
                new AiRecommendationV3Request.CvInput(
                        cvId, processedText, List.copyOf(canonicalSkills), languageCode,
                        languageConfidence, processingVersion
                ),
                List.copyOf(jobs), threshold, limit
        );
    }
}
