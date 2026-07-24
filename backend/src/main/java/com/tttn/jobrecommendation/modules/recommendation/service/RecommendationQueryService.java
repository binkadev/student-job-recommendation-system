package com.tttn.jobrecommendation.modules.recommendation.service;

import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunDetailResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunResponse;

import java.util.List;

public interface RecommendationQueryService {

    List<RecommendationRunResponse> getMyRecommendationRuns(Long userId);

    List<RecommendationResultResponse> getLatestRecommendationResults(Long userId);

    RecommendationRunDetailResponse getMyRecommendationRun(Long userId, Long runId);
}
