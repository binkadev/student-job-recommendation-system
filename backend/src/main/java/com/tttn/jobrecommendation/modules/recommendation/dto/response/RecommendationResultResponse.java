package com.tttn.jobrecommendation.modules.recommendation.dto.response;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class RecommendationResultResponse {

    private Long id;
    private Long jobId;
    private String jobTitle;
    private String companyName;
    private Integer rankPosition;
    private Integer tierRankPosition;
    private RecommendationRankingTier rankingTier;
    private BigDecimal rankingScore;
    private BigDecimal overallScore;
    /** @deprecated Use rankingScore; retained as the persisted score compatibility alias. */
    @Deprecated
    private BigDecimal score;
    private BigDecimal textScore;
    private BigDecimal skillScore;
    private RecommendationScoringStrategy scoringStrategy;
    private List<String> matchedKeywords;
    private List<String> missingSkills;
    private String reason;
    private LocalDateTime createdAt;
}
