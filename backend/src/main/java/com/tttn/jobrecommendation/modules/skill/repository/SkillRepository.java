package com.tttn.jobrecommendation.modules.skill.repository;

import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long>, JpaSpecificationExecutor<Skill> {

    Optional<Skill> findByNormalizedName(String normalizedName);

    boolean existsByNormalizedName(String normalizedName);
}
