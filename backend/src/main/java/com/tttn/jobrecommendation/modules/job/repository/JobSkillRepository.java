package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {

    boolean existsByJobIdAndSkillId(Long jobId, Long skillId);

    List<JobSkill> findByJobIdOrderByIdAsc(Long jobId);

    void deleteByJobId(Long jobId);
}
