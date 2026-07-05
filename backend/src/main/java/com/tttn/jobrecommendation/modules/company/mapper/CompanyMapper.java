package com.tttn.jobrecommendation.modules.company.mapper;

import com.tttn.jobrecommendation.modules.company.dto.response.CompanyResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import org.springframework.stereotype.Component;

@Component
public class CompanyMapper {

    public CompanyResponse toCompanyResponse(Company company) {
        return CompanyResponse.builder()
                .id(company.getId())
                .userId(company.getUser().getId())
                .email(company.getUser().getEmail())
                .companyName(company.getCompanyName())
                .taxCode(company.getTaxCode())
                .description(company.getDescription())
                .website(company.getWebsiteUrl())
                .address(company.getAddress())
                .phone(company.getPhone())
                .industry(company.getIndustry())
                .status(company.getStatus())
                .createdAt(company.getCreatedAt())
                .updatedAt(company.getUpdatedAt())
                .build();
    }
}
