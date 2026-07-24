package com.tttn.jobrecommendation.modules.notification.service.impl;

import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.modules.notification.dto.request.UpdateNotificationSettingsRequest;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationSettingsResponse;
import com.tttn.jobrecommendation.modules.notification.entity.UserNotificationSettings;
import com.tttn.jobrecommendation.modules.notification.mapper.NotificationSettingsMapper;
import com.tttn.jobrecommendation.modules.notification.repository.UserNotificationSettingsRepository;
import com.tttn.jobrecommendation.modules.notification.service.NotificationSettingsService;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationSettingsServiceImpl implements NotificationSettingsService {

    private final UserNotificationSettingsRepository settingsRepository;
    private final UserRepository userRepository;
    private final NotificationSettingsMapper notificationSettingsMapper;

    @Override
    @Transactional(readOnly = true)
    public NotificationSettingsResponse getMySettings(Long userId) {
        return settingsRepository.findByUserId(userId)
                .map(notificationSettingsMapper::toResponse)
                .orElseGet(notificationSettingsMapper::defaults);
    }

    @Override
    @Transactional
    public NotificationSettingsResponse updateMySettings(
            Long userId,
            UpdateNotificationSettingsRequest request
    ) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }

        settingsRepository.upsert(
                userId,
                request.getApplicationStatusEnabled(),
                request.getJobStatusEnabled(),
                request.getRecommendationEnabled(),
                request.getSystemEnabled()
        );

        UserNotificationSettings settings = settingsRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification settings not found"));
        return notificationSettingsMapper.toResponse(settings);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnabled(Long userId, NotificationType type) {
        return settingsRepository.findByUserId(userId)
                .map(settings -> isTypeEnabled(settings, type))
                .orElse(true);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> filterEnabledUserIds(Collection<Long> userIds, NotificationType type) {
        if (userIds.isEmpty()) {
            return Set.of();
        }

        Map<Long, UserNotificationSettings> settingsByUserId = settingsRepository.findByUserIdIn(userIds)
                .stream()
                .collect(Collectors.toMap(settings -> settings.getUser().getId(), Function.identity()));
        Set<Long> enabledUserIds = new HashSet<>();
        for (Long userId : userIds) {
            UserNotificationSettings settings = settingsByUserId.get(userId);
            if (settings == null || isTypeEnabled(settings, type)) {
                enabledUserIds.add(userId);
            }
        }
        return enabledUserIds;
    }

    private boolean isTypeEnabled(UserNotificationSettings settings, NotificationType type) {
        return switch (type) {
            case APPLICATION_STATUS_CHANGED -> settings.isApplicationStatusEnabled();
            case JOB_STATUS_CHANGED -> settings.isJobStatusEnabled();
            case RECOMMENDATION -> settings.isRecommendationEnabled();
            case SYSTEM -> settings.isSystemEnabled();
        };
    }
}
