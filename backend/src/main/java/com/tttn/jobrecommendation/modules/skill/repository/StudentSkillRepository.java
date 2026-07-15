package com.tttn.jobrecommendation.modules.skill.repository;

import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentSkillRepository extends JpaRepository<StudentSkill, Long> {

    List<StudentSkill> findByStudentIdOrderByIdAsc(Long studentId);
}
