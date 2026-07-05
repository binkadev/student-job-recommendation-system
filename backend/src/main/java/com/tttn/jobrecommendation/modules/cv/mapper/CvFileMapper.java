package com.tttn.jobrecommendation.modules.cv.mapper;

import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import org.springframework.stereotype.Component;

@Component
public class CvFileMapper {

    public CvFileResponse toCvFileResponse(CvFile cvFile) {
        return CvFileResponse.builder()
                .id(cvFile.getId())
                .originalFileName(resolveOriginalFileName(cvFile))
                .storedFileName(cvFile.getStoredFileName())
                .filePath(resolveFilePath(cvFile))
                .contentType(cvFile.getContentType())
                .fileSize(cvFile.getFileSize())
                .active(cvFile.isActive())
                .uploadedAt(cvFile.getUploadedAt())
                .build();
    }

    private String resolveOriginalFileName(CvFile cvFile) {
        return cvFile.getOriginalFileName() == null ? cvFile.getFileName() : cvFile.getOriginalFileName();
    }

    private String resolveFilePath(CvFile cvFile) {
        return cvFile.getFilePath() == null ? cvFile.getFileUrl() : cvFile.getFilePath();
    }
}
