package com.tttn.jobrecommendation.modules.candidateranking.repository;

import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CandidateRankingResultRepository extends JpaRepository<CandidateRankingResult, Long> {

    @EntityGraph(attributePaths = {"application.student.user", "cvFile"})
    List<CandidateRankingResult> findByRunIdOrderByRankPositionAsc(Long runId);
}
