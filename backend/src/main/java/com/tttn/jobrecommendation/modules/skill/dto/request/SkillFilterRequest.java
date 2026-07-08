package com.tttn.jobrecommendation.modules.skill.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SkillFilterRequest {

    @Size(max = 150)
    private String keyword;

    @Size(max = 100)
    private String category;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    @Max(100)
    private Integer size = 20;
}
