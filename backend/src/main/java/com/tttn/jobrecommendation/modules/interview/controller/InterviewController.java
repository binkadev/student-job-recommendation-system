package com.tttn.jobrecommendation.modules.interview.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.interview.dto.request.*;
import com.tttn.jobrecommendation.modules.interview.dto.response.InterviewResponse;
import com.tttn.jobrecommendation.modules.interview.service.InterviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@org.springframework.validation.annotation.Validated
@RestController
@RequiredArgsConstructor
public class InterviewController {
    private final InterviewService service;
    private final SecurityUtils security;

    @PostMapping("/api/companies/me/interviews")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<InterviewResponse> create(@Valid @RequestBody CreateInterviewRequest request) {
        return ApiResponse.success(service.create(security.getCurrentUserId(), request));
    }

    @GetMapping("/api/companies/me/interviews")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<PageResponse<InterviewResponse>> companyList(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return ApiResponse.success(service.list(security.getCurrentUserId(), true, page, size));
    }

    @GetMapping("/api/students/me/interviews")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<PageResponse<InterviewResponse>> studentList(
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        return ApiResponse.success(service.list(security.getCurrentUserId(), false, page, size));
    }

    @PatchMapping("/api/companies/me/interviews/{id}/status")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<InterviewResponse> companyUpdate(@PathVariable Long id, @Valid @RequestBody UpdateInterviewStatusRequest request) {
        return ApiResponse.success(service.update(security.getCurrentUserId(), true, id, request));
    }

    @PatchMapping("/api/students/me/interviews/{id}/respond")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<InterviewResponse> studentRespond(@PathVariable Long id, @Valid @RequestBody UpdateInterviewStatusRequest request) {
        return ApiResponse.success(service.update(security.getCurrentUserId(), false, id, request));
    }
}
