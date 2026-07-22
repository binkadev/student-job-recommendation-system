package com.tttn.jobrecommendation.modules.application.dto.response;

import java.nio.file.Path;

public record ApplicationCvDownload(
        Path path,
        String fileName,
        String contentType
) {
}
