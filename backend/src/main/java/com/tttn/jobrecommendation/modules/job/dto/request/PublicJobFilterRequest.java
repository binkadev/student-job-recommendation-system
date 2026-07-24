package com.tttn.jobrecommendation.modules.job.dto.request;

import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PublicJobFilterRequest {

    @Size(max = 255)
    private String keyword;

    @Size(max = 255)
    private String location;

    private JobType jobType;

    private WorkingModel workingModel;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    @Max(100)
    private Integer size = 10;
}
