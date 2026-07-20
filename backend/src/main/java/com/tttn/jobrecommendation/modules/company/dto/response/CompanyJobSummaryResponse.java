package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class CompanyJobSummaryResponse {

    private Long id;
    private String title;
    private String location;
    private JobType jobType;
    private WorkingModel workingModel;
    private JobStatus status;
    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private String currency;
    private LocalDate deadline;
    private LocalDateTime publishedAt;
}
