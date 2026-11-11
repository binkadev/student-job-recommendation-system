package com.tttn.jobrecommendation.modules.interview.dto.request;

import com.tttn.jobrecommendation.common.enums.MeetingType;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public record CreateInterviewRequest(
        @NotNull @Positive Long applicationId,
        @NotBlank @Size(max = 255) String title,
        @NotNull @Future LocalDateTime scheduledAt,
        @NotNull @Min(15) @Max(480) Integer durationMinutes,
        @NotNull MeetingType meetingType,
        @NotBlank @Size(max = 1000) String locationOrLink,
        @Size(max = 5000) String notes
) {
    // Framework DEBUG rendering must not include private meeting details or messages.
    @Override public String toString() { return "CreateInterviewRequest[redacted]"; }
}
