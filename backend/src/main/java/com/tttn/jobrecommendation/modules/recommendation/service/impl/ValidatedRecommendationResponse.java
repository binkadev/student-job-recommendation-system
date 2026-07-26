package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;

import java.math.BigDecimal;
import java.util.List;

public record ValidatedRecommendationResponse(
        String algorithm,
        String algorithmVersion,
        List<Result> results
) {

    public record Result(
            Long jobId,
            BigDecimal score,
            BigDecimal textScore,
            BigDecimal skillScore,
            RecommendationScoringStrategy scoringStrategy,
            Integer rankPosition,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason
    ) {
    }
}
