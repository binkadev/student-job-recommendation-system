package com.tttn.jobrecommendation.modules.application.repository;

import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {
}
