package com.tttn.jobrecommendation.modules.application.dto.request;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CompanyApplicationFilterRequest {

    private ApplicationStatus status;

    private Long jobId;

    @Size(max = 255)
    private String keyword;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    @Max(100)
    private Integer size = 10;

    @Size(max = 100)
    private String sort;
}
