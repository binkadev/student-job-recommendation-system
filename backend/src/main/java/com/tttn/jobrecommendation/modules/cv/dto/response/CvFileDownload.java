package com.tttn.jobrecommendation.modules.cv.dto.response;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

public record CvFileDownload(
        Resource resource,
        MediaType contentType,
        long contentLength,
        String originalFileName
) {

    public ResponseEntity<Resource> toResponseEntity(boolean download) {
        ContentDisposition contentDisposition = ContentDisposition
                .builder(download ? "attachment" : "inline")
                .filename(originalFileName, StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(contentType)
                .contentLength(contentLength)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .body(resource);
    }
}
