package com.tttn.jobrecommendation.modules.application.dto.response;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ApplicationResponse {

    private Long id;
    private ApplicationStatus status;
    private String coverLetter;
    private Long studentId;
    private String studentName;
    private String studentEmail;
    private Long jobId;
    private String jobTitle;
    private Long companyId;
    private String companyName;
    private Long cvFileId;
    private String cvFileName;
    private LocalDateTime appliedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
