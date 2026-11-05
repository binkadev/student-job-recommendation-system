package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SettingsRevision;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestHeader;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.company.dto.request.CompanyUpdateRequest;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyResponse;
import com.tttn.jobrecommendation.modules.company.service.CompanyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/companies")
@PreAuthorize("hasRole('COMPANY')")
@RequiredArgsConstructor
public class CompanyController {

    private final CompanyService companyService;
    private final SecurityUtils securityUtils;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<CompanyResponse>> getMe() {
        var data = companyService.getMe(securityUtils.getCurrentUserId());
        return ResponseEntity.ok().eTag(SettingsRevision.etag(data.getRevision())).body(ApiResponse.success(data));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<CompanyResponse>> updateMe(@Valid @RequestBody CompanyUpdateRequest request,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        var data = companyService.updateMe(securityUtils.getCurrentUserId(), request, SettingsRevision.parse(ifMatch));
        return ResponseEntity.ok().eTag(SettingsRevision.etag(data.getRevision()))
                .body(ApiResponse.success("Company updated successfully", data));
    }
}
