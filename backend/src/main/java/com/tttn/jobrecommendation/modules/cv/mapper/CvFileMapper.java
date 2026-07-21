package com.tttn.jobrecommendation.modules.cv.mapper;

import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import org.springframework.stereotype.Component;

@Component
public class CvFileMapper {

    public CvFileResponse toCvFileResponse(CvFile cvFile) {
        return CvFileResponse.builder()
                .id(cvFile.getId())
                .studentId(cvFile.getStudent().getId())
                .fileName(cvFile.getFileName())
                .originalFileName(resolveOriginalFileName(cvFile))
                .contentType(cvFile.getContentType())
                .fileSize(cvFile.getFileSize())
                .extractedText(cvFile.getExtractedText())
                .processedText(cvFile.getProcessedText())
                .active(cvFile.isActive())
                .uploadedAt(cvFile.getUploadedAt())
                .createdAt(cvFile.getCreatedAt())
                .updatedAt(cvFile.getUpdatedAt())
                .build();
    }

    private String resolveOriginalFileName(CvFile cvFile) {
        return cvFile.getOriginalFileName() == null ? cvFile.getFileName() : cvFile.getOriginalFileName();
    }
}
