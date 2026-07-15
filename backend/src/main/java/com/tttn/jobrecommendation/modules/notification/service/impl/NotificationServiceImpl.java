package com.tttn.jobrecommendation.modules.notification.service.impl;

import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.common.enums.ReferenceType;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.dto.response.UnreadNotificationCountResponse;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import com.tttn.jobrecommendation.modules.notification.mapper.NotificationMapper;
import com.tttn.jobrecommendation.modules.notification.repository.NotificationRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Profile("!no-db")
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private static final String APPLICATION_STATUS_TITLE = "Application status updated";

    private final NotificationRepository notificationRepository;
    private final NotificationMapper notificationMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getMyNotifications(Long userId, Integer page, Integer size) {
        Pageable pageable = PageRequest.of(
                Math.max(page == null ? 1 : page, 1) - 1,
                Math.min(Math.max(size == null ? 20 : size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        List<NotificationResponse> items = notifications.getContent()
                .stream()
                .map(notificationMapper::toNotificationResponse)
                .toList();

        return new PageResponse<>(
                items,
                notifications.getNumber() + 1,
                notifications.getSize(),
                notifications.getTotalElements(),
                notifications.getTotalPages()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public UnreadNotificationCountResponse getUnreadCount(Long userId) {
        return UnreadNotificationCountResponse.builder()
                .unreadCount(notificationRepository.countByUserIdAndReadFalse(userId))
                .build();
    }

    @Override
    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.save(notification);
        }

        return notificationMapper.toNotificationResponse(notification);
    }

    @Override
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllUnreadAsReadByUserId(userId, LocalDateTime.now());
    }

    @Override
    @Transactional
    public void createApplicationStatusChangedNotification(JobApplication application) {
        Notification notification = Notification.builder()
                .user(application.getStudent().getUser())
                .type(NotificationType.APPLICATION_STATUS_CHANGED)
                .title(APPLICATION_STATUS_TITLE)
                .message("Your application for " + application.getJob().getTitle()
                        + " has been updated to " + application.getStatus() + ".")
                .referenceType(ReferenceType.APPLICATION)
                .referenceId(application.getId())
                .read(false)
                .build();

        notificationRepository.save(notification);
    }
}
