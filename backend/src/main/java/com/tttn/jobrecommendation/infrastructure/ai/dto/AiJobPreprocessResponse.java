package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.math.BigDecimal;
import java.util.List;

public record AiJobPreprocessResponse(List<JobResult> results) {

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    public record JobResult(
            Long id,
            String processedText,
            String languageCode,
            BigDecimal languageConfidence,
            String processingVersion
    ) {
        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }
}
