package com.tttn.jobrecommendation.modules.job.repository;

import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {

    boolean existsByJobIdAndSkillId(Long jobId, Long skillId);

    @EntityGraph(attributePaths = {"skill"})
    List<JobSkill> findByJobIdOrderByIdAsc(Long jobId);

    @EntityGraph(attributePaths = {"job", "skill"})
    List<JobSkill> findByJobIdInOrderByJobIdAscIdAsc(Collection<Long> jobIds);

    void deleteByJobId(Long jobId);
}
