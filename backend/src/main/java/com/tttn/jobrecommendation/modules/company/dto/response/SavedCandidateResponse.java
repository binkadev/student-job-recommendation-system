package com.tttn.jobrecommendation.modules.company.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class SavedCandidateResponse {

    private Long id;
    private Long applicationId;
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
