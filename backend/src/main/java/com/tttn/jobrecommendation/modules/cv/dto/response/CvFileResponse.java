package com.tttn.jobrecommendation.modules.cv.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CvFileResponse {

    private Long id;
    private Long studentId;
    private String fileName;
    private String originalFileName;
    private String contentType;
    private Long fileSize;
    private String extractedText;
    private String processedText;

    @JsonProperty("isActive")
    private boolean active;

    private LocalDateTime uploadedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
