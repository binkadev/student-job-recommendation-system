package com.tttn.jobrecommendation.modules.recommendation.repository;

public interface RecommendationResultCountProjection {

    Long getRunId();

    Long getTotalRecommended();
}
