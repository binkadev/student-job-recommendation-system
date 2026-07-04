package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.SavedJob;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedJobRepository extends JpaRepository<SavedJob, Long> {
}
