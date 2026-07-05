package com.tttn.jobrecommendation.modules.application.repository;

import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {

    boolean existsByStudentIdAndJobId(Long studentId, Long jobId);

    List<JobApplication> findByStudentIdOrderByAppliedAtDesc(Long studentId);

    List<JobApplication> findByJobIdOrderByAppliedAtDesc(Long jobId);
}
