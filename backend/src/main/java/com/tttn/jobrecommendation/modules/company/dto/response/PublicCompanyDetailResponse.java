package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class PublicCompanyDetailResponse {

    private Long id;
    private String companyName;
    private String industry;
    private String address;
    private String websiteUrl;
    private String description;
    private CompanyStatus status;
    private Long openJobs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String companySize;
    private String logoUrl;
    private List<CompanyJobSummaryResponse> jobs;
}
