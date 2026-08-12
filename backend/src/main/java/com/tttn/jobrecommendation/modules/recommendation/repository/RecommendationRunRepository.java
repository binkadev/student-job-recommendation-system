package com.tttn.jobrecommendation.modules.recommendation.repository;

import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RecommendationRunRepository extends JpaRepository<RecommendationRun, Long> {

    List<RecommendationRun> findByStudentIdOrderByCreatedAtDesc(Long studentId);

    Optional<RecommendationRun> findFirstByStudentIdAndStatusOrderByCreatedAtDescIdDesc(
            Long studentId,
            RecommendationRunStatus status
    );

    Optional<RecommendationRun> findByIdAndStudentId(Long id, Long studentId);

    boolean existsByCvFileId(Long cvFileId);

    @Query("select distinct run.cvFile.id from RecommendationRun run where run.cvFile.id in :cvFileIds")
    List<Long> findReferencedCvFileIds(@Param("cvFileIds") Collection<Long> cvFileIds);
}
