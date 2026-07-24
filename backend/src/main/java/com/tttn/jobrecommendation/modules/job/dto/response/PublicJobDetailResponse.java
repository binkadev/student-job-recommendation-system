package com.tttn.jobrecommendation.modules.job.dto.response;

import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class PublicJobDetailResponse {

    private Long id;
    private Long companyId;
    private String companyName;
    private String title;
    private String description;
    private String requirements;
    private String benefits;
    private String location;
    private JobType jobType;
    private WorkingModel workingModel;
    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private String currency;
    private LocalDate deadline;
    private List<PublicJobSkillResponse> skills;
    private LocalDateTime publishedAt;
}
