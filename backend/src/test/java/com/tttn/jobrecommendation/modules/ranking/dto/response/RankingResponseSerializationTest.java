package com.tttn.jobrecommendation.modules.ranking.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingResultResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RankingResponseSerializationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void studentAndCompanyResultsExposeAllV3SemanticFieldsIncludingFallbackNullOverall() throws Exception {
        RecommendationResultResponse student = RecommendationResultResponse.builder().rankPosition(1).tierRankPosition(1)
                .rankingTier(RecommendationRankingTier.FALLBACK).rankingScore(BigDecimal.ONE).overallScore(null).score(BigDecimal.ONE)
                .textScore(null).skillScore(BigDecimal.ONE).scoringStrategy(RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED).build();
        CandidateRankingResultResponse company = new CandidateRankingResultResponse(1L, 2L, 3L, "Student", "student@example.test", 4L, "cv.pdf", null, null,
                RecommendationRankingTier.FALLBACK, BigDecimal.ONE, null, 1, BigDecimal.ONE, null, BigDecimal.ONE,
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of(), List.of(), null, 1, null);

        assertResultFields(mapper.readTree(mapper.writeValueAsString(student)));
        assertResultFields(mapper.readTree(mapper.writeValueAsString(company)));
    }

    @Test
    void companyRunSerializationPreservesDistinctV2AndV3LimitNullability() throws Exception {
        CandidateRankingRunDetailResponse v3 = new CandidateRankingRunDetailResponse(1L, 2L, "Job", null, "tfidf-cosine-hybrid", "bilingual-candidate-ranking-v3", new BigDecimal("0.1"), null, 20, 15, 0, 0, 0, 0, 0, 0, null, null, null, null, List.of());
        CandidateRankingRunDetailResponse v2 = new CandidateRankingRunDetailResponse(1L, 2L, "Job", null, "tfidf-cosine-hybrid", "bilingual-candidate-ranking-v2", new BigDecimal("0.1"), 20, null, null, 0, 0, 0, 0, 0, 0, null, null, null, null, List.of());
        JsonNode v3Json = mapper.readTree(mapper.writeValueAsString(v3)); JsonNode v2Json = mapper.readTree(mapper.writeValueAsString(v2));
        assertThat(v3Json.path("requestedLimit").isNull()).isTrue();
        assertThat(v3Json.path("requestedPrimaryLimit").asInt()).isEqualTo(20);
        assertThat(v3Json.path("requestedFallbackLimit").asInt()).isEqualTo(15);
        assertThat(v2Json.path("requestedLimit").asInt()).isEqualTo(20);
        assertThat(v2Json.path("requestedPrimaryLimit").isNull()).isTrue();
        assertThat(v2Json.path("requestedFallbackLimit").isNull()).isTrue();
    }

    private void assertResultFields(JsonNode json) {
        for (String field : List.of("rankPosition", "tierRankPosition", "rankingTier", "rankingScore", "overallScore", "score", "textScore", "skillScore", "scoringStrategy")) assertThat(json.has(field)).isTrue();
        assertThat(json.path("rankingTier").asText()).isEqualTo("FALLBACK");
        assertThat(json.path("rankingScore").decimalValue()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(json.path("overallScore").isNull()).isTrue();
        assertThat(json.path("textScore").isNull()).isTrue();
    }
}
