package com.tttn.jobrecommendation.modules.invitation.dto.request;

import jakarta.validation.constraints.*;

public record CreateInvitationRequest(
        @NotNull @Positive Long studentId,
        @NotNull @Positive Long jobId,
        @Size(max = 5000) String message
) {
    // Framework DEBUG rendering must not include private meeting details or messages.
    @Override public String toString() { return "CreateInvitationRequest[redacted]"; }
}
