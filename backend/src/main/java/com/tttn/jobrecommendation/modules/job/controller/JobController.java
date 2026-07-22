package com.tttn.jobrecommendation.modules.job.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.job.dto.request.CreateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.JobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobRequest;
import com.tttn.jobrecommendation.modules.job.dto.request.UpdateJobStatusRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;
import com.tttn.jobrecommendation.modules.job.service.JobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<PageResponse<JobResponse>> getJobs(@Valid @ModelAttribute JobFilterRequest request) {
        return ApiResponse.success(jobService.getJobs(
                request,
                securityUtils.getCurrentUserIdOrNull(),
                securityUtils.getCurrentUserRoleOrNull()
        ));
    }

    @GetMapping("/{id}")
    public ApiResponse<JobDetailResponse> getJob(@PathVariable Long id) {
        return ApiResponse.success(jobService.getJob(
                id,
                securityUtils.getCurrentUserIdOrNull(),
                securityUtils.getCurrentUserRoleOrNull()
        ));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('COMPANY', 'ADMIN')")
    public ApiResponse<JobDetailResponse> createJob(@Valid @RequestBody CreateJobRequest request) {
        return ApiResponse.success("Job created successfully", jobService.createJob(
                request,
                securityUtils.getCurrentUserId(),
                securityUtils.getCurrentUserRole()
        ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('COMPANY', 'ADMIN')")
    public ApiResponse<JobDetailResponse> updateJob(
            @PathVariable Long id,
            @Valid @RequestBody UpdateJobRequest request
    ) {
        return ApiResponse.success("Job updated successfully", jobService.updateJob(
                id,
                request,
                securityUtils.getCurrentUserId(),
                securityUtils.getCurrentUserRole()
        ));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('COMPANY', 'ADMIN')")
    public ApiResponse<JobDetailResponse> updateJobStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateJobStatusRequest request
    ) {
        return ApiResponse.success("Job status updated successfully", jobService.updateJobStatus(
                id,
                request,
                securityUtils.getCurrentUserId(),
                securityUtils.getCurrentUserRole()
        ));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('COMPANY', 'ADMIN')")
    public ApiResponse<JobDetailResponse> closeJob(@PathVariable Long id) {
        return ApiResponse.success("Job closed successfully", jobService.closeJob(
                id,
                securityUtils.getCurrentUserId(),
                securityUtils.getCurrentUserRole()
        ));
    }
}
