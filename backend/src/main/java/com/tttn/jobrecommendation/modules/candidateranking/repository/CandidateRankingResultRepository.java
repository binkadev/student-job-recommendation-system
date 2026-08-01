package com.tttn.jobrecommendation.modules.candidateranking.repository;

import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CandidateRankingResultRepository extends JpaRepository<CandidateRankingResult, Long> {

    @EntityGraph(attributePaths = {"application.student.user", "cvFile"})
    List<CandidateRankingResult> findByRunIdOrderByRankPositionAsc(Long runId);

    @Query("""
            select result.run.id as runId, count(result.id) as totalRanked
            from CandidateRankingResult result
            where result.run.id in :runIds
            group by result.run.id
            """)
    List<CandidateRankingResultCountProjection> countResultsByRunIds(
            @Param("runIds") Collection<Long> runIds
    );
}
