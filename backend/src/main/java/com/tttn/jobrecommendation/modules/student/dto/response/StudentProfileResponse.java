package com.tttn.jobrecommendation.modules.student.dto.response;

import com.tttn.jobrecommendation.common.enums.JobType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class StudentProfileResponse {

    private Long id;
    private Long studentId;
    private String headline;
    private String summary;
    private String education;
    private String experience;
    private String projects;
    private String targetPosition;
    private String preferredLocation;
    private JobType preferredJobType;
    private String rawText;
    private String processedText;
    private Integer profileCompleteness;
    private LocalDateTime updatedAt;
}
