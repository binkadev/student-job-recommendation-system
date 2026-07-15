package com.tttn.jobrecommendation.modules.notification.service.impl;

import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.dto.response.UnreadNotificationCountResponse;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Profile("no-db")
public class NoDbNotificationServiceImpl implements NotificationService {

    @Override
    public PageResponse<NotificationResponse> getMyNotifications(Long userId, Integer page, Integer size) {
        int pageNumber = page == null ? 1 : page;
        int pageSize = size == null ? 20 : size;
        return new PageResponse<>(List.of(), pageNumber, pageSize, 0, 0);
    }

    @Override
    public UnreadNotificationCountResponse getUnreadCount(Long userId) {
        return UnreadNotificationCountResponse.builder()
                .unreadCount(0)
                .build();
    }

    @Override
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        throw new ResourceNotFoundException("Notification not found");
    }

    @Override
    public void markAllAsRead(Long userId) {
    }

    @Override
    public void createApplicationStatusChangedNotification(JobApplication application) {
    }
}
