package com.tttn.jobrecommendation.modules.application.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.application.dto.request.AdminApplicationFilterRequest;
import com.tttn.jobrecommendation.modules.application.dto.response.ApplicationResponse;
import com.tttn.jobrecommendation.modules.application.service.ApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin Applications")
@RestController
@RequestMapping("/api/admin/applications")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminApplicationController {

    private final ApplicationService applicationService;

    @Operation(summary = "List applications for admins")
    @GetMapping
    public ApiResponse<PageResponse<ApplicationResponse>> getApplications(
            @Valid @ModelAttribute AdminApplicationFilterRequest request
    ) {
        return ApiResponse.success(applicationService.getAdminApplications(request));
    }

    @Operation(summary = "Get application detail for admins")
    @GetMapping("/{applicationId}")
    public ApiResponse<ApplicationResponse> getApplication(@PathVariable Long applicationId) {
        return ApiResponse.success(applicationService.getAdminApplication(applicationId));
    }
}
