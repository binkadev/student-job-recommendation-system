package com.tttn.jobrecommendation.modules.skill.mapper;

import com.tttn.jobrecommendation.modules.skill.dto.response.StudentSkillResponse;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import org.springframework.stereotype.Component;

@Component
public class StudentSkillMapper {

    public StudentSkillResponse toStudentSkillResponse(StudentSkill studentSkill) {
        return StudentSkillResponse.builder()
                .studentSkillId(studentSkill.getId())
                .skillId(studentSkill.getSkill().getId())
                .skillName(studentSkill.getSkill().getName())
                .normalizedName(studentSkill.getSkill().getNormalizedName())
                .category(studentSkill.getSkill().getCategory())
                .proficiencyLevel(studentSkill.getLevel())
                .yearsOfExperience(studentSkill.getYearsOfExperience())
                .source(studentSkill.getSource())
                .build();
    }
}
