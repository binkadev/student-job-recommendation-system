package com.tttn.jobrecommendation.modules.recommendation.dto.response;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class RecommendationRunDetailResponse {

    private Long id;
    private Long cvId;
    private RecommendationSourceType sourceType;
    private RecommendationRunStatus status;
    private Integer totalRecommended;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private LocalDateTime createdAt;
    private List<RecommendationResultResponse> results;
}
