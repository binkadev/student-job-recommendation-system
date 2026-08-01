package com.tttn.jobrecommendation.modules.candidateranking.repository;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CandidateRankingRunRepository extends JpaRepository<CandidateRankingRun, Long> {

    Page<CandidateRankingRun> findByJobId(Long jobId, Pageable pageable);

    Optional<CandidateRankingRun> findByIdAndJobId(Long id, Long jobId);

    Optional<CandidateRankingRun> findByRequestId(UUID requestId);

    Optional<CandidateRankingRun> findFirstByJobIdAndStatusOrderByCreatedAtDescIdDesc(
            Long jobId,
            RecommendationRunStatus status
    );
}
