package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.SavedJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SavedJobRepository extends JpaRepository<SavedJob, Long> {

    boolean existsByStudentIdAndJobId(Long studentId, Long jobId);

    Optional<SavedJob> findByStudentIdAndJobId(Long studentId, Long jobId);

    Page<SavedJob> findByStudentIdOrderByCreatedAtDesc(Long studentId, Pageable pageable);
}
