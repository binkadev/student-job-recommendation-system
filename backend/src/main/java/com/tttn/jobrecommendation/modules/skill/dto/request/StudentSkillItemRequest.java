package com.tttn.jobrecommendation.modules.skill.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class StudentSkillItemRequest {

    @NotNull
    private Long skillId;

    @NotNull
    @JsonAlias("level")
    private SkillLevel proficiencyLevel;

    @PositiveOrZero
    @Digits(integer = 3, fraction = 1)
    private BigDecimal yearsOfExperience;

    @NotNull
    private SkillSource source;
}
