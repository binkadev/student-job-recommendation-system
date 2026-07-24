package com.tttn.jobrecommendation.modules.company.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SaveCandidateRequest {

    @NotNull
    @Positive
    private Long applicationId;

    @Size(max = 2000)
    private String note;

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }
}
