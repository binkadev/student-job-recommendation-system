package com.tttn.jobrecommendation.modules.skill.mapper;

import com.tttn.jobrecommendation.modules.skill.dto.response.SkillResponse;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import org.springframework.stereotype.Component;

@Component
public class SkillMapper {

    public SkillResponse toSkillResponse(Skill skill) {
        return SkillResponse.builder()
                .id(skill.getId())
                .name(skill.getName())
                .normalizedName(skill.getNormalizedName())
                .category(skill.getCategory())
                .description(skill.getDescription())
                .createdAt(skill.getCreatedAt())
                .updatedAt(skill.getUpdatedAt())
                .build();
    }
}
