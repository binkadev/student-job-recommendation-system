package com.tttn.jobrecommendation.modules.recommendation.mapper;

import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationMapperTest {
    private final RecommendationMapper mapper = new RecommendationMapper();

    @Test
    void mapsPersistedPrimaryFallbackAndLegacyValuesWithoutInferringTier() {
        Job job = Job.builder().id(10L).title("Backend").company(Company.builder().companyName("Acme").build()).build();
        RecommendationResult primary = result(job, RecommendationRankingTier.PRIMARY, new BigDecimal("0.70000"), new BigDecimal("0.70000"), new BigDecimal("0.80000"), 1);
        RecommendationResult fallback = result(job, RecommendationRankingTier.FALLBACK, new BigDecimal("1.00000"), null, null, 2);
        RecommendationResult legacy = result(job, null, new BigDecimal("0.45000"), null, new BigDecimal("0.45000"), null);

        var primaryResponse = mapper.toRecommendationResultResponse(primary);
        var fallbackResponse = mapper.toRecommendationResultResponse(fallback);
        var legacyResponse = mapper.toRecommendationResultResponse(legacy);

        assertThat(primaryResponse.getRankingTier()).isEqualTo(RecommendationRankingTier.PRIMARY);
        assertThat(primaryResponse.getRankingScore()).isEqualByComparingTo("0.70000");
        assertThat(primaryResponse.getOverallScore()).isEqualByComparingTo("0.70000");
        assertThat(primaryResponse.getTierRankPosition()).isEqualTo(1);
        assertThat(fallbackResponse.getRankingTier()).isEqualTo(RecommendationRankingTier.FALLBACK);
        assertThat(fallbackResponse.getRankingScore()).isEqualByComparingTo("1.00000");
        assertThat(fallbackResponse.getScore()).isEqualByComparingTo("1.00000");
        assertThat(fallbackResponse.getOverallScore()).isNull();
        assertThat(fallbackResponse.getTextScore()).isNull();
        assertThat(legacyResponse.getRankingTier()).isNull();
        assertThat(legacyResponse.getTierRankPosition()).isNull();
        assertThat(legacyResponse.getScore()).isEqualByComparingTo("0.45000");
    }

    private RecommendationResult result(Job job, RecommendationRankingTier tier, BigDecimal ranking, BigDecimal overall, BigDecimal text, Integer tierRank) {
        return RecommendationResult.builder().id(1L).job(job).rankingTier(tier).rankingScore(ranking).overallScore(overall)
                .textScore(text).skillScore(new BigDecimal("0.50000")).scoringStrategy(RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED)
                .matchedKeywords(List.of("java")).missingSkills(List.of()).rankPosition(1).tierRankPosition(tierRank).build();
    }
}
