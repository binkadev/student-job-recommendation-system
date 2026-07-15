package com.tttn.jobrecommendation.modules.skill.dto.response;

import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class StudentSkillResponse {

    private Long studentSkillId;
    private Long skillId;
    private String skillName;
    private String normalizedName;
    private String category;
    private SkillLevel proficiencyLevel;
    private BigDecimal yearsOfExperience;
    private SkillSource source;
}
