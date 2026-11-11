package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.common.utils.SettingsRevision;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyVerificationDocumentStatus;
import com.tttn.jobrecommendation.modules.company.service.impl.CompanyVerificationDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartHttpServletRequest;

@RestController
@RequestMapping("/api/companies/me/verification-document")
@PreAuthorize("hasRole('COMPANY')")
@RequiredArgsConstructor
public class CompanyVerificationDocumentController {
    private final CompanyVerificationDocumentService documents;
    private final SecurityUtils security;

    @GetMapping
    public ResponseEntity<ApiResponse<CompanyVerificationDocumentStatus>> status() {
        return VerificationDocumentHttp.status(documents.companyStatus(security.getCurrentUserId()));
    }
    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CompanyVerificationDocumentStatus>> upload(MultipartHttpServletRequest request,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        Long revision = SettingsRevision.parse(ifMatch);
        return VerificationDocumentHttp.status(documents.upload(security.getCurrentUserId(), revision, VerificationDocumentHttp.singleFile(request)));
    }
    @GetMapping("/file")
    public ResponseEntity<byte[]> download() {
        return VerificationDocumentHttp.download(documents.companyDownload(security.getCurrentUserId()));
    }
}
