package com.tttn.jobrecommendation.modules.cv.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import com.tttn.jobrecommendation.modules.cv.service.CvService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/students/me/cv")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;
    private final SecurityUtils securityUtils;

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

    @GetMapping
    public ApiResponse<List<CvFileResponse>> getMyCvFiles() {
        return ApiResponse.success(cvService.getMyCvFiles(securityUtils.getCurrentUserId()));
    }

    @GetMapping("/active")
    public ApiResponse<CvFileResponse> getActiveCv() {
        return ApiResponse.success(cvService.getActiveCv(securityUtils.getCurrentUserId()));
    }
}
