package com.tttn.jobrecommendation.modules.recommendation.repository;

import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecommendationResultRepository extends JpaRepository<RecommendationResult, Long> {

    List<RecommendationResult> findByRunIdOrderByRankPositionAsc(Long runId);

    int countByRunId(Long runId);
}
