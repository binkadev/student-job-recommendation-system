package com.tttn.jobrecommendation.modules.job.dto.response;

import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class JobSkillResponse {

    private Long id;
    private Long skillId;
    private String skillName;
    private String normalizedName;
    private String category;
    private SkillImportance importance;
    private SkillLevel minLevel;
}
