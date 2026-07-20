package com.tttn.jobrecommendation.modules.user.dto.request;

import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUserFilterRequest {

    private UserRole role;

    @Size(max = 255)
    private String fullName;

    @Size(max = 255)
    private String keyword;

    private UserStatus status;

    @Min(1)
    private Integer page = 1;

    @Min(1)
    @Max(100)
    private Integer size = 10;

    @Size(max = 100)
    private String sort;
}
