package com.tttn.jobrecommendation.modules.notification.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.notification.dto.response.NotificationResponse;
import com.tttn.jobrecommendation.modules.notification.dto.response.UnreadNotificationCountResponse;
import com.tttn.jobrecommendation.modules.notification.service.NotificationService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/notifications")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<PageResponse<NotificationResponse>> getMyNotifications(
            @RequestParam(defaultValue = "1") @Min(1) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size
    ) {
        return ApiResponse.success(notificationService.getMyNotifications(
                securityUtils.getCurrentUserId(),
                page,
                size
        ));
    }

    @GetMapping("/unread-count")
    public ApiResponse<UnreadNotificationCountResponse> getUnreadCount() {
        return ApiResponse.success(notificationService.getUnreadCount(securityUtils.getCurrentUserId()));
    }

    @PatchMapping("/{id}/read")
    public ApiResponse<NotificationResponse> markAsRead(@PathVariable Long id) {
        return ApiResponse.success(
                "Notification marked as read",
                notificationService.markAsRead(securityUtils.getCurrentUserId(), id)
        );
    }

    @PatchMapping("/read-all")
    public ApiResponse<Void> markAllAsRead() {
        notificationService.markAllAsRead(securityUtils.getCurrentUserId());
        return ApiResponse.success("Notifications marked as read", null);
    }
}
