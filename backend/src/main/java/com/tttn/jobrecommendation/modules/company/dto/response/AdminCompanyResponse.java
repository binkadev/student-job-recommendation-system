package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminCompanyResponse {

    private Long id;
    private Long userId;
    private String email;
    private String companyName;
    private String taxCode;
    private String websiteUrl;
    private String industry;
    private String description;
    private String address;
    private String phone;
    private CompanyStatus status;
    private Long openJobs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String companySize;
    private String logoUrl;
}
