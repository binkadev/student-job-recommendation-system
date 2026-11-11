package com.tttn.jobrecommendation.modules.student.dto.response;

import com.tttn.jobrecommendation.common.enums.JobType;
import com.tttn.jobrecommendation.common.enums.WorkingModel;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentCertificateItem;
import com.tttn.jobrecommendation.modules.student.dto.request.StudentLanguageItem;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
    private String educationLevel;
    private BigDecimal gpa;
    private String preferredLocation;
    private JobType preferredJobType;
    private WorkingModel preferredWorkingModel;
    private String githubUrl;
    private String linkedinUrl;
    private String portfolioUrl;
    private List<StudentCertificateItem> certificates;
    private List<StudentLanguageItem> languages;
    private String rawText;
    private String processedText;
    private Integer profileCompleteness;
    private LocalDateTime updatedAt;
}
