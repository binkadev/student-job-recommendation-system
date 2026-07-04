package com.tttn.jobrecommendation.modules.skill.repository;

import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillRepository extends JpaRepository<Skill, Long> {
}
