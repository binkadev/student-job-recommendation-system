package com.tttn.jobrecommendation.modules.application.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.application.dto.request.ApplyJobRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.UpdateApplicationStatusRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;
import com.tttn.jobrecommendation.modules.application.service.ApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final SecurityUtils securityUtils;

    @PostMapping("/api/jobs/{jobId}/apply")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<ApplicationResponse> apply(
            @PathVariable Long jobId,
            @Valid @RequestBody ApplyJobRequest request
    ) {
        return ApiResponse.success(
                "Application submitted successfully",
                applicationService.apply(jobId, request, securityUtils.getCurrentUserId())
        );
    }

    @GetMapping("/api/students/me/applications")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<ApplicationResponse>> getMyApplications() {
        return ApiResponse.success(applicationService.getMyApplications(securityUtils.getCurrentUserId()));
    }

    @GetMapping("/api/companies/me/jobs/{jobId}/applications")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<List<ApplicationResponse>> getCompanyJobApplications(@PathVariable Long jobId) {
        return ApiResponse.success(applicationService.getCompanyJobApplications(jobId, securityUtils.getCurrentUserId()));
    }

    @PatchMapping("/api/applications/{id}/status")
    @PreAuthorize("hasAnyRole('STUDENT', 'COMPANY', 'ADMIN')")
    public ApiResponse<ApplicationResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateApplicationStatusRequest request
    ) {
        return ApiResponse.success(
                "Application status updated successfully",
                applicationService.updateStatus(
                        id,
                        request,
                        securityUtils.getCurrentUserId(),
                        securityUtils.getCurrentUserRole()
                )
        );
    }
}
