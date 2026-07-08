package com.tttn.jobrecommendation.modules.skill.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SkillRequest {

    @NotBlank
    @Size(max = 150)
    private String name;

    @Size(max = 100)
    private String category;

    @Size(max = 5000)
    private String description;
}
