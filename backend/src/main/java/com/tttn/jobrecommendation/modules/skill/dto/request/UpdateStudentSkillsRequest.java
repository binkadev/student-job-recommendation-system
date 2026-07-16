package com.tttn.jobrecommendation.modules.skill.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class UpdateStudentSkillsRequest {

    @NotNull
    @Size(max = 200)
    @Valid
    private List<StudentSkillItemRequest> skills;
}
