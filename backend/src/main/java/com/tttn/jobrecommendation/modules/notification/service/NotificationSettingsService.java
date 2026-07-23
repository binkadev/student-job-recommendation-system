package com.tttn.jobrecommendation.modules.notification.service;

import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.modules.notification.dto.request.UpdateNotificationSettingsRequest;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationSettingsResponse;

import java.util.Collection;
import java.util.Set;

public interface NotificationSettingsService {

    NotificationSettingsResponse getMySettings(Long userId);

    NotificationSettingsResponse updateMySettings(Long userId, UpdateNotificationSettingsRequest request);

    boolean isEnabled(Long userId, NotificationType type);

    Set<Long> filterEnabledUserIds(Collection<Long> userIds, NotificationType type);
}
