package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import java.math.BigDecimal;
import java.util.List;

public record ValidatedRecommendationResponse(
        String algorithmVersion,
        List<Result> results
) {

    public record Result(
            Long jobId,
            BigDecimal score,
            Integer rank,
            List<String> matchedSkills
    ) {
    }
}
