package com.tttn.jobrecommendation.modules.job.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.job.dto.response.SavedJobResponse;
import com.tttn.jobrecommendation.modules.job.service.SavedJobService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/students/me/saved-jobs")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class SavedJobController {

    private final SavedJobService savedJobService;
    private final SecurityUtils securityUtils;

    @PostMapping("/{jobId}")
    public ApiResponse<SavedJobResponse> saveJob(@PathVariable Long jobId) {
        return ApiResponse.success(
                "Job saved successfully",
                savedJobService.saveJob(securityUtils.getCurrentUserId(), jobId)
        );
    }

    @GetMapping
    public ApiResponse<PageResponse<SavedJobResponse>> getMySavedJobs(
            @RequestParam(defaultValue = "1") @Min(1) Integer page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) Integer size
    ) {
        return ApiResponse.success(savedJobService.getMySavedJobs(securityUtils.getCurrentUserId(), page, size));
    }

    @DeleteMapping("/{jobId}")
    public ApiResponse<Void> removeSavedJob(@PathVariable Long jobId) {
        savedJobService.removeSavedJob(securityUtils.getCurrentUserId(), jobId);
        return ApiResponse.success("Saved job removed successfully", null);
    }
}
