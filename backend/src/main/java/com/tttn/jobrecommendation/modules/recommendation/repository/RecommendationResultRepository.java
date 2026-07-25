package com.tttn.jobrecommendation.modules.recommendation.repository;

import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecommendationResultRepository extends JpaRepository<RecommendationResult, Long> {

    @EntityGraph(attributePaths = {"job", "job.company"})
    List<RecommendationResult> findByRunIdOrderByRankPositionAsc(Long runId);

    @Query("""
            select result.run.id as runId, count(result.id) as totalRecommended
            from RecommendationResult result
            where result.run.id in :runIds
            group by result.run.id
            """)
    List<RecommendationResultCountProjection> countResultsByRunIds(@Param("runIds") List<Long> runIds);
}
