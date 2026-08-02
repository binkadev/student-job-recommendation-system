package com.tttn.jobrecommendation.modules.candidateranking.repository;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CandidateRankingRunRepository extends JpaRepository<CandidateRankingRun, Long> {

    Page<CandidateRankingRun> findByJobId(Long jobId, Pageable pageable);

    @EntityGraph(attributePaths = "job")
    Page<CandidateRankingRun> findByJobIdOrderByCreatedAtDescIdDesc(Long jobId, Pageable pageable);

    @EntityGraph(attributePaths = "job")
    Optional<CandidateRankingRun> findByIdAndJobId(Long id, Long jobId);

    Optional<CandidateRankingRun> findByRequestId(UUID requestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select run
            from CandidateRankingRun run
            where run.id = :runId
            """)
    Optional<CandidateRankingRun> findByIdForUpdate(@Param("runId") Long runId);

    Optional<CandidateRankingRun> findFirstByJobIdAndStatusOrderByCreatedAtDescIdDesc(
            Long jobId,
            RecommendationRunStatus status
    );
}
