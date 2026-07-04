package com.tttn.jobrecommendation.modules.recommendation.repository;

import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationRunRepository extends JpaRepository<RecommendationRun, Long> {
}
