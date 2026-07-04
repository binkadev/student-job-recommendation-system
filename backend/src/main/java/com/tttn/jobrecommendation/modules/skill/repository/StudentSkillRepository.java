package com.tttn.jobrecommendation.modules.skill.repository;

import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentSkillRepository extends JpaRepository<StudentSkill, Long> {
}
