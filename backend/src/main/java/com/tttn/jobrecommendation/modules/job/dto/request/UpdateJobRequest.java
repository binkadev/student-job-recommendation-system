package com.tttn.jobrecommendation.modules.job.dto.request;

import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class UpdateJobRequest {

    @Size(max = 255)
    private String title;

    @Size(max = 10000)
    private String description;

    @Size(max = 10000)
    private String requirements;

    @Size(max = 10000)
    private String benefits;

    @Size(max = 255)
    private String location;

    private JobType jobType;

    private WorkingModel workingModel;

    @PositiveOrZero
    private BigDecimal salaryMin;

    @PositiveOrZero
    private BigDecimal salaryMax;

    @Size(max = 10)
    private String currency;

    private LocalDate deadline;
}
