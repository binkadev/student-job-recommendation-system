package com.tttn.jobrecommendation.modules.application.repository;

import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long>, JpaSpecificationExecutor<JobApplication> {

    boolean existsByStudentIdAndJobId(Long studentId, Long jobId);

    List<JobApplication> findByStudentIdOrderByAppliedAtDesc(Long studentId);

    List<JobApplication> findByJobIdOrderByAppliedAtDesc(Long jobId);

    Optional<JobApplication> findByIdAndStudentId(Long id, Long studentId);
}
