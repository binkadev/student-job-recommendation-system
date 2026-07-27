package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
public class AiRecommendationRequestMapper {

    public AiRecommendationRequest toRequest(
            UUID requestId,
            Long cvId,
            String text,
            List<String> extractedSkills,
            List<AiRecommendationRequest.JobInput> jobs,
            BigDecimal threshold,
            Integer limit
    ) {
        return new AiRecommendationRequest(
                requestId,
                new AiRecommendationRequest.CvInput(
                        cvId,
                        text,
                        List.copyOf(extractedSkills)
                ),
                List.copyOf(jobs),
                threshold,
                limit
        );
    }
}
