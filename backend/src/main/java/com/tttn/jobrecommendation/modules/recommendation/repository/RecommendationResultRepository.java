package com.tttn.jobrecommendation.modules.recommendation.repository;

import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationResultRepository extends JpaRepository<RecommendationResult, Long> {
}
