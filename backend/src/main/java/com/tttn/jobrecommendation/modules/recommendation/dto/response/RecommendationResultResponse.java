package com.tttn.jobrecommendation.modules.recommendation.dto.response;

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
    private List<String> matchedKeywords;
    private String reason;
    private LocalDateTime createdAt;
}
