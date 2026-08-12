package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;

import java.math.BigDecimal;
import java.util.List;

record ValidatedRecommendationV3Response(
        String algorithm,
        String algorithmVersion,
        List<Result> results
) {
    record Result(
            Long jobId,
            RecommendationRankingTier rankingTier,
            BigDecimal rankingScore,
            BigDecimal overallScore,
            BigDecimal textScore,
            BigDecimal skillScore,
            RecommendationScoringStrategy scoringStrategy,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason,
            Integer rankPosition,
            Integer tierRankPosition
    ) {
    }
}
