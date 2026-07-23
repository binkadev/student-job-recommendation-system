package com.tttn.jobrecommendation.modules.student.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SavedSearchRequest {

    @NotBlank
    @Size(max = 100)
    private String name;

    @Size(max = 255)
    private String keyword;

    @Size(max = 255)
    private String location;

    private JobType jobType;

    private WorkingModel workingModel;

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }
}
