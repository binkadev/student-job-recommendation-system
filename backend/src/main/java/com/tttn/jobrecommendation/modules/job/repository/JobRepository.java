package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobRepository extends JpaRepository<Job, Long> {
}
