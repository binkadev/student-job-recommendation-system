package com.tttn.jobrecommendation.modules.job.dto.request;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class CreateJobRequest {

    private Long companyId;

    @NotBlank
    @Size(max = 255)
    private String title;

    @NotBlank
    @Size(max = 10000)
    private String description;

    @Size(max = 10000)
    private String requirements;

    @Size(max = 10000)
    private String benefits;

    @Size(max = 255)
    private String location;

    @NotNull
    private JobType jobType;

    @NotNull
    private WorkingModel workingModel;

    private JobStatus status;

    @PositiveOrZero
    private BigDecimal salaryMin;

    @PositiveOrZero
    private BigDecimal salaryMax;

    @Size(max = 10)
    private String currency;

    private LocalDate deadline;

    @Valid
    private List<JobSkillRequest> skills;
}
