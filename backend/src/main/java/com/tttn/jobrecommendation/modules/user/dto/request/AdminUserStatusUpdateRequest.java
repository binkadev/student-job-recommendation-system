package com.tttn.jobrecommendation.modules.user.dto.request;

import com.tttn.jobrecommendation.common.enums.UserStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUserStatusUpdateRequest {

    @NotNull
    private UserStatus status;
}
