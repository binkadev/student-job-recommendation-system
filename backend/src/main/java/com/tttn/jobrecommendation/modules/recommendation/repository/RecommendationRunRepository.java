package com.tttn.jobrecommendation.modules.recommendation.repository;

import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecommendationRunRepository extends JpaRepository<RecommendationRun, Long> {

    List<RecommendationRun> findByStudentIdOrderByCreatedAtDesc(Long studentId);

    Optional<RecommendationRun> findFirstByStudentIdOrderByCreatedAtDesc(Long studentId);
}
