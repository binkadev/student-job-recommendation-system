package com.tttn.jobrecommendation.modules.recommendation.service;

import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunDetailResponse;

public interface RecommendationGenerationService {

    RecommendationRunDetailResponse generate(Long userId, GenerateRecommendationRequest request);
}
