package com.tttn.jobrecommendation.modules.job.dto.request;

import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class JobSkillRequest {

    @NotNull
    private Long skillId;

    private SkillImportance importance;

    private SkillLevel minLevel;
}
