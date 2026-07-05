package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CompanyResponse {

    private Long id;
    private Long userId;
    private String email;
    private String companyName;
    private String taxCode;
    private String description;
    private String website;
    private String address;
    private String phone;
    private String industry;
    private CompanyStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
