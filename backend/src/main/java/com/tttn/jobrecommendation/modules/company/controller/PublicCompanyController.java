package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.PublicCompanyFilterRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyDetailResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.PublicCompanyResponse;
import com.tttn.jobrecommendation.modules.company.service.PublicCompanyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Public Companies")
@SecurityRequirements
@RestController
@RequestMapping("/api/public/companies")
@RequiredArgsConstructor
public class PublicCompanyController {

    private final PublicCompanyService publicCompanyService;

    @Operation(summary = "List verified public companies")
    @GetMapping
    public ApiResponse<PageResponse<PublicCompanyResponse>> getCompanies(
            @Valid @ModelAttribute PublicCompanyFilterRequest request
    ) {
        return ApiResponse.success(publicCompanyService.getCompanies(request));
    }

    @Operation(summary = "Get verified public company detail")
    @GetMapping("/{id}")
    public ApiResponse<PublicCompanyDetailResponse> getCompany(@PathVariable Long id) {
        return ApiResponse.success(publicCompanyService.getCompany(id));
    }
}
