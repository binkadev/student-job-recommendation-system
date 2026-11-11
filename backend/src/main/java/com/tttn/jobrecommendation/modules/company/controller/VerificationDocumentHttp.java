package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SettingsRevision;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyVerificationDocumentStatus;
import com.tttn.jobrecommendation.modules.company.dto.response.VerificationDocumentDownload;
import org.springframework.http.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

final class VerificationDocumentHttp {
    private VerificationDocumentHttp() {}
    static MultipartFile singleFile(MultipartHttpServletRequest request) {
        var parts = request.getMultiFileMap();
        if (parts.size() != 1 || !parts.containsKey("file") || parts.get("file").size() != 1 || !request.getParameterMap().isEmpty())
            throw new AppException(ErrorCode.BAD_REQUEST, "Provide exactly one verification document in the file part");
        return parts.getFirst("file");
    }
    static ResponseEntity<ApiResponse<CompanyVerificationDocumentStatus>> status(CompanyVerificationDocumentStatus data) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).eTag(SettingsRevision.etag(data.revision()))
                .body(ApiResponse.success(data));
    }
    static ResponseEntity<byte[]> download(VerificationDocumentDownload file) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("verification-document." + file.extension()).build().toString())
                .contentType(MediaType.parseMediaType(file.mediaType())).contentLength(file.content().length).body(file.content());
    }
}
