package com.tttn.jobrecommendation.infrastructure.ai.dto;

import java.util.List;

public record AiCvParseResponse(
        String rawText,
        String processedText,
        List<String> skills
) {
}
