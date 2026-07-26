package com.tttn.jobrecommendation.modules.cv.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateCvExtractedDataRequest {

    public static final int MAX_TEXT_LENGTH = 1_000_000;

    @Size(max = MAX_TEXT_LENGTH)
    private String extractedText;

    @Size(max = MAX_TEXT_LENGTH)
    private String processedText;

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }
}
