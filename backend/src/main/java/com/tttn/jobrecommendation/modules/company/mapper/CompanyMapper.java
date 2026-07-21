package com.tttn.jobrecommendation.modules.company.mapper;

import com.tttn.jobrecommendation.modules.company.dto.response.AdminCompanyResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyJobSummaryResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyDetailResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyResponse;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.springframework.stereotype.Component;

import java.util.List;

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

    public PublicCompanyResponse toPublicCompanyResponse(Company company, Long openJobs) {
        return PublicCompanyResponse.builder()
                .id(company.getId())
                .companyName(company.getCompanyName())
                .industry(company.getIndustry())
                .address(company.getAddress())
                .websiteUrl(company.getWebsiteUrl())
                .description(company.getDescription())
                .status(company.getStatus())
                .openJobs(openJobs)
                .createdAt(company.getCreatedAt())
                .updatedAt(company.getUpdatedAt())
                .companySize(null)
                .logoUrl(null)
                .build();
    }

    public PublicCompanyDetailResponse toPublicCompanyDetailResponse(
            Company company,
            Long openJobs,
            List<CompanyJobSummaryResponse> jobs
    ) {
        return PublicCompanyDetailResponse.builder()
                .id(company.getId())
                .companyName(company.getCompanyName())
                .industry(company.getIndustry())
                .address(company.getAddress())
                .websiteUrl(company.getWebsiteUrl())
                .description(company.getDescription())
                .status(company.getStatus())
                .openJobs(openJobs)
                .createdAt(company.getCreatedAt())
                .updatedAt(company.getUpdatedAt())
                .companySize(null)
                .logoUrl(null)
                .jobs(jobs)
                .build();
    }

    public AdminCompanyResponse toAdminCompanyResponse(Company company, Long openJobs) {
        return AdminCompanyResponse.builder()
                .id(company.getId())
                .userId(company.getUser().getId())
                .email(company.getUser().getEmail())
                .companyName(company.getCompanyName())
                .taxCode(company.getTaxCode())
                .websiteUrl(company.getWebsiteUrl())
                .industry(company.getIndustry())
                .description(company.getDescription())
                .address(company.getAddress())
                .phone(company.getPhone())
                .status(company.getStatus())
                .openJobs(openJobs)
                .createdAt(company.getCreatedAt())
                .updatedAt(company.getUpdatedAt())
                .companySize(null)
                .logoUrl(null)
                .build();
    }

    public CompanyJobSummaryResponse toCompanyJobSummaryResponse(Job job) {
        return CompanyJobSummaryResponse.builder()
                .id(job.getId())
                .title(job.getTitle())
                .location(job.getLocation())
                .jobType(job.getJobType())
                .workingModel(job.getWorkingModel())
                .status(job.getStatus())
                .salaryMin(job.getSalaryMin())
                .salaryMax(job.getSalaryMax())
                .currency(job.getCurrency())
                .deadline(job.getDeadline())
                .publishedAt(job.getPublishedAt())
                .build();
    }
}
