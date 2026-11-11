package com.tttn.jobrecommendation.modules.invitation.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.invitation.dto.request.*;
import com.tttn.jobrecommendation.modules.invitation.dto.response.InvitationResponse;
import com.tttn.jobrecommendation.modules.invitation.service.InvitationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@org.springframework.validation.annotation.Validated
@RestController
@RequiredArgsConstructor
public class InvitationController {
    private final InvitationService service;
    private final SecurityUtils security;

    @PostMapping("/api/companies/me/invitations")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<InvitationResponse> create(@Valid @RequestBody CreateInvitationRequest request) {
        return ApiResponse.success(service.create(security.getCurrentUserId(), request));
    }

    @GetMapping("/api/companies/me/invitations")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<PageResponse<InvitationResponse>> companyList(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return ApiResponse.success(service.list(security.getCurrentUserId(), true, page, size));
    }

    @GetMapping("/api/students/me/invitations")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<PageResponse<InvitationResponse>> studentList(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return ApiResponse.success(service.list(security.getCurrentUserId(), false, page, size));
    }

    @PatchMapping("/api/companies/me/invitations/{id}/status")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<InvitationResponse> companyUpdate(@PathVariable Long id, @Valid @RequestBody UpdateInvitationStatusRequest request) {
        return ApiResponse.success(service.update(security.getCurrentUserId(), true, id, request));
    }

    @PatchMapping("/api/students/me/invitations/{id}/respond")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<InvitationResponse> studentRespond(@PathVariable Long id, @Valid @RequestBody UpdateInvitationStatusRequest request) {
        return ApiResponse.success(service.update(security.getCurrentUserId(), false, id, request));
    }
}
