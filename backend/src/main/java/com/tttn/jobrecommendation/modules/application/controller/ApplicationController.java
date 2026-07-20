package com.tttn.jobrecommendation.modules.application.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.application.dto.request.ApplyJobRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.CompanyApplicationFilterRequest;
import com.tttn.jobrecommendation.modules.application.dto.request.UpdateApplicationStatusRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;
import com.tttn.jobrecommendation.modules.application.service.ApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Applications")
@RestController
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final SecurityUtils securityUtils;

    @Operation(summary = "Apply to an active job")
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

    @Operation(summary = "List current student's applications")
    @GetMapping("/api/students/me/applications")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<ApplicationResponse>> getMyApplications() {
        return ApiResponse.success(applicationService.getMyApplications(securityUtils.getCurrentUserId()));
    }

    @Operation(summary = "Get current student's application detail")
    @GetMapping("/api/students/me/applications/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<ApplicationResponse> getMyApplication(@PathVariable Long id) {
        return ApiResponse.success(applicationService.getMyApplication(id, securityUtils.getCurrentUserId()));
    }

    @Operation(summary = "List applications across current company's jobs")
    @GetMapping("/api/companies/me/applications")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<PageResponse<ApplicationResponse>> getMyCompanyApplications(
            @Valid @ModelAttribute CompanyApplicationFilterRequest request
    ) {
        return ApiResponse.success(applicationService.getMyCompanyApplications(
                securityUtils.getCurrentUserId(),
                request
        ));
    }

    @Operation(summary = "Get current company's application detail")
    @GetMapping("/api/companies/me/applications/{id}")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<ApplicationResponse> getMyCompanyApplication(@PathVariable Long id) {
        return ApiResponse.success(applicationService.getMyCompanyApplication(
                id,
                securityUtils.getCurrentUserId()
        ));
    }

    @Operation(summary = "List applications for a current-company job")
    @GetMapping("/api/companies/me/jobs/{jobId}/applications")
    @PreAuthorize("hasRole('COMPANY')")
    public ApiResponse<List<ApplicationResponse>> getCompanyJobApplications(@PathVariable Long jobId) {
        return ApiResponse.success(applicationService.getCompanyJobApplications(jobId, securityUtils.getCurrentUserId()));
    }

    @Operation(summary = "Update application status")
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
