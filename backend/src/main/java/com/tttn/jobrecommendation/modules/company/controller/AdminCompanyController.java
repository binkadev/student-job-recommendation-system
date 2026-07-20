package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.AdminCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.request.AdminCompanyStatusUpdateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.AdminCompanyResponse;
import com.tttn.jobrecommendation.modules.company.service.AdminCompanyService;
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

@Tag(name = "Admin Companies")
@RestController
@RequestMapping("/api/admin/companies")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCompanyController {

    private final AdminCompanyService adminCompanyService;

    @Operation(summary = "List companies for admins")
    @GetMapping
    public ApiResponse<PageResponse<AdminCompanyResponse>> getCompanies(
            @Valid @ModelAttribute AdminCompanyFilterRequest request
    ) {
        return ApiResponse.success(adminCompanyService.getCompanies(request));
    }

    @Operation(summary = "Get company detail for admins")
    @GetMapping("/{id}")
    public ApiResponse<AdminCompanyResponse> getCompany(@PathVariable Long id) {
        return ApiResponse.success(adminCompanyService.getCompany(id));
    }

    @Operation(summary = "Update company verification status")
    @PatchMapping("/{id}/status")
    public ApiResponse<AdminCompanyResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody AdminCompanyStatusUpdateRequest request
    ) {
        return ApiResponse.success(
                "Company status updated successfully",
                adminCompanyService.updateStatus(id, request)
        );
    }
}
