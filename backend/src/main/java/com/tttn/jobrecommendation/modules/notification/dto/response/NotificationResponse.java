package com.tttn.jobrecommendation.modules.notification.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.common.enums.ReferenceType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationResponse {

    private Long id;
    private NotificationType type;
    private String title;
    private String message;
    private ReferenceType referenceType;
    private Long referenceId;

    @JsonProperty("isRead")
    private boolean read;

    private LocalDateTime readAt;
    private LocalDateTime createdAt;
}
