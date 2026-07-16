package com.tttn.jobrecommendation.modules.notification.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UnreadNotificationCountResponse {

    private long unreadCount;
}
