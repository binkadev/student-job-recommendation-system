package com.tttn.jobrecommendation.infrastructure.ai.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.util.List;

public record AiJobPreprocessRequest(List<JobItem> jobs) {

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }

    public record JobItem(Long id, String text) {
        @JsonAnySetter
        public void rejectUnknownField(String fieldName, Object value) {
            throw new IllegalArgumentException("Unsupported field: " + fieldName);
        }
    }
}
