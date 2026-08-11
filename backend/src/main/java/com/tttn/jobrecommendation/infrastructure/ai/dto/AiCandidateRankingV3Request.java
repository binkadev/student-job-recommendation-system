package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record AiCandidateRankingV3Request(
        UUID requestId,
        JobInput job,
        List<CandidateInput> candidates,
        BigDecimal threshold,
        Integer primaryLimit,
        Integer fallbackLimit
) {
    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    public record JobInput(Long id, String text, List<String> skills) {
        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }

    public record CandidateInput(
            Long applicationId,
            Long cvId,
            String processedText,
            List<String> skills,
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
