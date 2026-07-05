package com.tttn.jobrecommendation.modules.job.dto.request;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateJobStatusRequest {

    @NotNull
    private JobStatus status;
}
