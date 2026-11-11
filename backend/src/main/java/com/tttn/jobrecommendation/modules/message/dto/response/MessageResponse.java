package com.tttn.jobrecommendation.modules.message.dto.response;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.message.entity.Message;
import java.time.LocalDateTime;

public record MessageResponse(Long id, Long conversationId, Long senderUserId, UserRole senderRole,
        String content, boolean isRead, LocalDateTime createdAt) {
    public static MessageResponse from(Message m) {
        return new MessageResponse(m.getId(), m.getConversation().getId(), m.getSender().getId(),
                m.getSenderRole(), m.getContent(), m.isRead(), m.getCreatedAt());
    }
    @Override public String toString() { return "MessageResponse[redacted]"; }
}
