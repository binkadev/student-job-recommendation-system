package com.tttn.jobrecommendation.modules.notification.mapper;

import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import org.springframework.stereotype.Component;

@Component
public class NotificationMapper {

    public NotificationResponse toNotificationResponse(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .type(notification.getType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .referenceType(notification.getReferenceType())
                .referenceId(notification.getReferenceId())
                .read(notification.isRead())
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
