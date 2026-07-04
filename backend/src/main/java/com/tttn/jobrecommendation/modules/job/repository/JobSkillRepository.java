package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {
}
