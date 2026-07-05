package com.tttn.jobrecommendation.modules.application.mapper;

import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import org.springframework.stereotype.Component;

@Component
public class ApplicationMapper {

    public ApplicationResponse toApplicationResponse(JobApplication application) {
        return ApplicationResponse.builder()
                .id(application.getId())
                .status(application.getStatus())
                .coverLetter(application.getCoverLetter())
                .studentId(application.getStudent().getId())
                .studentName(application.getStudent().getUser().getFullName())
                .studentEmail(application.getStudent().getUser().getEmail())
                .jobId(application.getJob().getId())
                .jobTitle(application.getJob().getTitle())
                .companyId(application.getJob().getCompany().getId())
                .companyName(application.getJob().getCompany().getCompanyName())
                .cvFileId(application.getCvFile() == null ? null : application.getCvFile().getId())
                .cvFileName(application.getCvFile() == null ? null : application.getCvFile().getFileName())
                .appliedAt(application.getAppliedAt())
                .reviewedAt(application.getReviewedAt())
                .createdAt(application.getCreatedAt())
                .updatedAt(application.getUpdatedAt())
                .build();
    }
}
