package com.tttn.jobrecommendation.modules.message.dto.response;

import com.tttn.jobrecommendation.modules.message.entity.Conversation;
import java.time.LocalDateTime;

public record ConversationResponse(Long id, Long applicationId, Long companyId, Long studentId, Long jobId,
        LocalDateTime lastMessageAt, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static ConversationResponse from(Conversation c) {
        return new ConversationResponse(c.getId(), c.getApplication().getId(), c.getCompany().getId(),
                c.getStudent().getId(), c.getApplication().getJob().getId(),
                c.getLastMessageAt(), c.getCreatedAt(), c.getUpdatedAt());
    }
}
