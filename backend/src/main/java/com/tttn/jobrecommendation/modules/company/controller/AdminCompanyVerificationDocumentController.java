package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyVerificationDocumentStatus;
import com.tttn.jobrecommendation.modules.company.service.impl.CompanyVerificationDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/companies/{companyId}/verification-document")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCompanyVerificationDocumentController {
    private final CompanyVerificationDocumentService documents;
    @GetMapping
    public ResponseEntity<ApiResponse<CompanyVerificationDocumentStatus>> status(@PathVariable Long companyId) {
        return VerificationDocumentHttp.status(documents.adminStatus(companyId));
    }
    @GetMapping("/file")
    public ResponseEntity<byte[]> download(@PathVariable Long companyId) {
        return VerificationDocumentHttp.download(documents.adminDownload(companyId));
    }
}
