package com.tttn.jobrecommendation.modules.user.dto.response;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminCompanyProfileSummaryResponse {

    private Long companyId;
    private String companyName;
    private String taxCode;
    private String websiteUrl;
    private String industry;
    private String description;
    private String address;
    private String phone;
    private CompanyStatus status;
    private String companySize;
    private String logoUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
