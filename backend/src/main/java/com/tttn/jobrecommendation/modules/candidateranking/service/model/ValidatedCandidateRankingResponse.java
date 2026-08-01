package com.tttn.jobrecommendation.modules.candidateranking.service.model;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ValidatedCandidateRankingResponse(
        String algorithm,
        String algorithmVersion,
        List<Result> results
) {

    public ValidatedCandidateRankingResponse {
        results = List.copyOf(results);
    }

    public record Result(
            Long applicationId,
            Long cvId,
            BigDecimal score,
            BigDecimal textScore,
            BigDecimal skillScore,
            RecommendationScoringStrategy scoringStrategy,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason,
            Integer rankPosition,
            String cvProcessingVersion,
            LocalDateTime cvAnalyzedAt
    ) {

        public Result {
            matchedSkills = List.copyOf(matchedSkills);
            missingSkills = List.copyOf(missingSkills);
        }
    }
}
