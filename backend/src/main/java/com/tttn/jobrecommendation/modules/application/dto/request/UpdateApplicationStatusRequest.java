package com.tttn.jobrecommendation.modules.application.dto.request;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateApplicationStatusRequest {

    @NotNull
    private ApplicationStatus status;
}
