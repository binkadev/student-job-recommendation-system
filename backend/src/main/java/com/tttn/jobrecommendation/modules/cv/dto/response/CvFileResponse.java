package com.tttn.jobrecommendation.modules.cv.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CvFileResponse {

    private Long id;
    private String originalFileName;
    private String storedFileName;
    private String filePath;
    private String contentType;
    private Long fileSize;
    private boolean active;
    private LocalDateTime uploadedAt;
}
