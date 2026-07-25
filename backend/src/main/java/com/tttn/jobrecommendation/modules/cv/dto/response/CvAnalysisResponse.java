package com.tttn.jobrecommendation.modules.cv.dto.response;

import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class CvAnalysisResponse {

    private Long cvId;
    private String extractedText;
    private String processedText;
    private List<String> skills;
    private CvAnalysisStatus status;
    private LocalDateTime uploadedAt;
    private LocalDateTime updatedAt;
}
