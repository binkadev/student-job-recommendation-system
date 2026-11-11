package com.tttn.jobrecommendation.modules.message.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;

public record SendMessageRequest(@NotBlank @Size(max = 5000) @Pattern(regexp = "[^\\x00]*", message = "must not contain NUL") String content) {
    // Reject client-supplied participant/sender fields locally, without changing global Jackson behavior.
    @JsonAnySetter
    public void rejectUnknown(String field, JsonNode value) {
        throw new IllegalArgumentException("Unsupported request field");
    }
    @Override public String toString() { return "SendMessageRequest[redacted]"; }
}
