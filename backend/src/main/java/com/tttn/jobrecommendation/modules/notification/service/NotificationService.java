package com.tttn.jobrecommendation.modules.notification.service;

import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.dto.response.UnreadNotificationCountResponse;

public interface NotificationService {

    PageResponse<NotificationResponse> getMyNotifications(Long userId, Integer page, Integer size);

    UnreadNotificationCountResponse getUnreadCount(Long userId);

    NotificationResponse markAsRead(Long userId, Long notificationId);

    void markAllAsRead(Long userId);

    void createApplicationStatusChangedNotification(JobApplication application);
}
