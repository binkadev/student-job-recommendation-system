package com.tttn.jobrecommendation.modules.notification.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateNotificationSettingsRequest {

    @NotNull
    private Boolean applicationStatusEnabled;

    @NotNull
    private Boolean jobStatusEnabled;

    @NotNull
    private Boolean recommendationEnabled;

    @NotNull
    private Boolean systemEnabled;

    @JsonAnySetter
    public void rejectUnknownField(String fieldName, Object value) {
        throw new IllegalArgumentException("Unsupported field: " + fieldName);
    }
}
