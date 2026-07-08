package com.tttn.jobrecommendation.modules.skill.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class SkillResponse {

    private Long id;
    private String name;
    private String normalizedName;
    private String category;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
