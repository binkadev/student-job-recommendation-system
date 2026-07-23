package com.tttn.jobrecommendation.modules.user.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.user.dto.request.ChangePasswordRequest;
import com.tttn.jobrecommendation.modules.user.service.UserPasswordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/me/password")
@PreAuthorize("hasAnyRole('STUDENT', 'COMPANY', 'ADMIN')")
@RequiredArgsConstructor
public class UserPasswordController {

    private final UserPasswordService userPasswordService;
    private final SecurityUtils securityUtils;

    @PatchMapping
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userPasswordService.changePassword(securityUtils.getCurrentUserId(), request);
        return ApiResponse.success("Password changed successfully", null);
    }
}
