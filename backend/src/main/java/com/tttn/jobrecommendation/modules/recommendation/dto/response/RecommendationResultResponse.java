package com.tttn.jobrecommendation.modules.recommendation.dto.response;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
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
    private BigDecimal score;
    private BigDecimal textScore;
    private BigDecimal skillScore;
    private RecommendationScoringStrategy scoringStrategy;
    private List<String> matchedKeywords;
    private List<String> missingSkills;
    private String reason;
    private LocalDateTime createdAt;
}
