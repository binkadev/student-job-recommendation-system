package com.tttn.jobrecommendation.modules.notification.mapper;

import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationSettingsResponse;
import com.tttn.jobrecommendation.modules.notification.entity.UserNotificationSettings;
import org.springframework.stereotype.Component;

@Component
public class NotificationSettingsMapper {

    public NotificationSettingsResponse toResponse(UserNotificationSettings settings) {
        return NotificationSettingsResponse.builder()
                .applicationStatusEnabled(settings.isApplicationStatusEnabled())
                .jobStatusEnabled(settings.isJobStatusEnabled())
                .recommendationEnabled(settings.isRecommendationEnabled())
                .systemEnabled(settings.isSystemEnabled())
                .updatedAt(settings.getUpdatedAt())
                .build();
    }

    public NotificationSettingsResponse defaults() {
        return NotificationSettingsResponse.builder()
                .applicationStatusEnabled(true)
                .jobStatusEnabled(true)
                .recommendationEnabled(true)
                .systemEnabled(true)
                .updatedAt(null)
                .build();
    }
}
