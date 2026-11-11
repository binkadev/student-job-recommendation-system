package com.tttn.jobrecommendation.modules.interview.dto.request;

import com.tttn.jobrecommendation.common.enums.InterviewStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateInterviewStatusRequest(@NotNull InterviewStatus expectedStatus, @NotNull InterviewStatus status) {}
