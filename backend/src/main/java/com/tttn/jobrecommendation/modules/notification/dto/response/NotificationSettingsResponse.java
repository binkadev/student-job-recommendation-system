package com.tttn.jobrecommendation.modules.notification.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationSettingsResponse {

    private boolean applicationStatusEnabled;
    private boolean jobStatusEnabled;
    private boolean recommendationEnabled;
    private boolean systemEnabled;
    private LocalDateTime updatedAt;
}
