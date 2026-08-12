package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record AiCandidateRankingV3Response(
        UUID requestId,
        String algorithm,
        String algorithmVersion,
        List<Result> results
) {
    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    public record Result(
            Long applicationId,
            Long cvId,
            RecommendationRankingTier rankingTier,
            BigDecimal rankingScore,
            BigDecimal overallScore,
            BigDecimal textScore,
            BigDecimal skillScore,
            RecommendationScoringStrategy scoringStrategy,
            List<String> matchedSkills,
            List<String> missingSkills
    ) {
        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }
}
