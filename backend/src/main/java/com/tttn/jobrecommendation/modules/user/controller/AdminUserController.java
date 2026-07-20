package com.tttn.jobrecommendation.modules.user.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.user.dto.request.AdminUserFilterRequest;
import com.tttn.jobrecommendation.modules.user.dto.request.AdminUserStatusUpdateRequest;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserDetailResponse;
import com.tttn.jobrecommendation.modules.user.dto.response.AdminUserResponse;
import com.tttn.jobrecommendation.modules.user.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin Users")
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;
    private final SecurityUtils securityUtils;

    @Operation(summary = "List users for admins")
    @GetMapping
    public ApiResponse<PageResponse<AdminUserResponse>> getUsers(
            @Valid @ModelAttribute AdminUserFilterRequest request
    ) {
        return ApiResponse.success(adminUserService.getUsers(request));
    }

    @Operation(summary = "Get user detail for admins")
    @GetMapping("/{id}")
    public ApiResponse<AdminUserDetailResponse> getUser(@PathVariable Long id) {
        return ApiResponse.success(adminUserService.getUser(id));
    }

    @Operation(summary = "Update user status")
    @PatchMapping("/{id}/status")
    public ApiResponse<AdminUserResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody AdminUserStatusUpdateRequest request
    ) {
        return ApiResponse.success(
                "User status updated successfully",
                adminUserService.updateStatus(id, request, securityUtils.getCurrentUserId())
        );
    }
}
