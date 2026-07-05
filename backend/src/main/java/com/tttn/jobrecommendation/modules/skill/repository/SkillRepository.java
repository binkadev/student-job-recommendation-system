package com.tttn.jobrecommendation.modules.skill.repository;

import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findByNormalizedName(String normalizedName);
}
