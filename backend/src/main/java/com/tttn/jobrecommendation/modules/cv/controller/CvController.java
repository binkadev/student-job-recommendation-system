package com.tttn.jobrecommendation.modules.cv.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import com.tttn.jobrecommendation.modules.cv.service.CvService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "CV")
@RestController
@RequestMapping("/api/students/me/cv")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;
    private final SecurityUtils securityUtils;

    @Operation(summary = "Upload a CV")
    @PostMapping
    public ApiResponse<CvFileResponse> uploadCv(
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "active", defaultValue = "true") boolean active
    ) {
        return ApiResponse.success("CV uploaded successfully", cvService.uploadCv(
                securityUtils.getCurrentUserId(),
                file,
                active
        ));
    }

    @Operation(summary = "List current student's CV files")
    @GetMapping
    public ApiResponse<List<CvFileResponse>> getMyCvFiles() {
        return ApiResponse.success(cvService.getMyCvFiles(securityUtils.getCurrentUserId()));
    }

    @Operation(summary = "Get current student's active CV")
    @GetMapping("/active")
    public ApiResponse<CvFileResponse> getActiveCv() {
        return ApiResponse.success(cvService.getActiveCv(securityUtils.getCurrentUserId()));
    }

    @Operation(summary = "Get current student's CV detail")
    @GetMapping("/{id}")
    public ApiResponse<CvFileResponse> getMyCvFile(@PathVariable Long id) {
        return ApiResponse.success(cvService.getMyCvFile(securityUtils.getCurrentUserId(), id));
    }

    @Operation(summary = "Set current student's active CV")
    @PatchMapping("/{id}/active")
    public ApiResponse<CvFileResponse> activateCv(@PathVariable Long id) {
        return ApiResponse.success(
                "CV activated successfully",
                cvService.activateCv(securityUtils.getCurrentUserId(), id)
        );
    }
}
