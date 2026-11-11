package com.tttn.jobrecommendation.modules.invitation.dto.request;

import com.tttn.jobrecommendation.common.enums.InvitationStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateInvitationStatusRequest(@NotNull InvitationStatus expectedStatus, @NotNull InvitationStatus status) {}
