package com.tttn.jobrecommendation.modules.notification.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.notification.dto.request.UpdateNotificationSettingsRequest;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationSettingsResponse;
import com.tttn.jobrecommendation.modules.notification.service.NotificationSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/me/notification-settings")
@PreAuthorize("hasAnyRole('STUDENT', 'COMPANY', 'ADMIN')")
@RequiredArgsConstructor
public class NotificationSettingsController {

    private final NotificationSettingsService notificationSettingsService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<NotificationSettingsResponse> getMySettings() {
        return ApiResponse.success(notificationSettingsService.getMySettings(securityUtils.getCurrentUserId()));
    }

    @PutMapping
    public ApiResponse<NotificationSettingsResponse> updateMySettings(
            @Valid @RequestBody UpdateNotificationSettingsRequest request
    ) {
        return ApiResponse.success(
                "Notification settings updated successfully",
                notificationSettingsService.updateMySettings(securityUtils.getCurrentUserId(), request)
        );
    }
}
