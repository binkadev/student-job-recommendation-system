package com.tttn.jobrecommendation.modules.recommendation.dto.response;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RecommendationRunResponse {

    private Long id;
    private RecommendationSourceType sourceType;
    private String algorithm;
    private String algorithmVersion;
    private Integer totalJobsScanned;
    private Integer totalRecommended;
    private RecommendationRunStatus status;
    private LocalDateTime createdAt;
}
