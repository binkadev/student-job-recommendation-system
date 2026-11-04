package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class SavedCandidateResponse {

    private Long id;
    private Long applicationId;
    private ApplicationStatus applicationStatus;
    private Long revision;
    private Long studentId;
    private String studentName;
    private String studentEmail;
    private String university;
    private String major;
    private String headline;
    private Long jobId;
    private String jobTitle;
    private Long cvFileId;
    private String cvFileName;
    private String note;
    private LocalDateTime savedAt;
    private LocalDateTime updatedAt;
}
