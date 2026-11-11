package com.tttn.jobrecommendation.modules.invitation.dto.response;

import com.tttn.jobrecommendation.common.enums.InvitationStatus;
import com.tttn.jobrecommendation.modules.invitation.entity.JobInvitation;
import java.time.LocalDateTime;

public record InvitationResponse(Long id, Long companyId, Long studentId, Long jobId, String message,
        InvitationStatus status, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static InvitationResponse from(JobInvitation i) {
        return new InvitationResponse(i.getId(), i.getCompany().getId(), i.getStudent().getId(),
                i.getJob().getId(), i.getMessage(), i.getStatus(), i.getCreatedAt(), i.getUpdatedAt());
    }
    @Override public String toString() { return "InvitationResponse[redacted]"; }
}
