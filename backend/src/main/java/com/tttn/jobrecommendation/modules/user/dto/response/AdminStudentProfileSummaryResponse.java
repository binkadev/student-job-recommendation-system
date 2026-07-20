package com.tttn.jobrecommendation.modules.user.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminStudentProfileSummaryResponse {

    private Long studentId;
    private String studentCode;
    private String university;
    private String major;
    private Integer graduationYear;
    private String location;
    private Long profileId;
    private String headline;
    private String targetPosition;
    private Integer profileCompleteness;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
