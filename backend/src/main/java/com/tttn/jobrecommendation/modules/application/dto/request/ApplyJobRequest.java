package com.tttn.jobrecommendation.modules.application.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ApplyJobRequest {

    private Long cvFileId;

    @Size(max = 5000)
    private String coverLetter;
}
