package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PublicCompanyResponse {

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
}
