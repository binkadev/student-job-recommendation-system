package com.tttn.jobrecommendation.modules.job.controller;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.job.dto.request.PublicJobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobDetailResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.PublicJobResponse;
import com.tttn.jobrecommendation.modules.job.service.PublicJobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Public Jobs")
@SecurityRequirements
@RestController
@RequestMapping("/api/public/jobs")
@RequiredArgsConstructor
public class PublicJobController {

    private final PublicJobService publicJobService;

    @Operation(summary = "List publicly visible jobs")
    @GetMapping
    public ApiResponse<PageResponse<PublicJobResponse>> getJobs(
            @Valid @ModelAttribute PublicJobFilterRequest request,
            @Parameter(hidden = true) @RequestParam(name = "status", required = false) String status
    ) {
        rejectStatusFilter(status);
        return ApiResponse.success(publicJobService.getJobs(request));
    }

    @Operation(summary = "Get publicly visible job detail")
    @GetMapping("/{jobId}")
    public ApiResponse<PublicJobDetailResponse> getJob(@PathVariable Long jobId) {
        return ApiResponse.success(publicJobService.getJob(jobId));
    }

    private void rejectStatusFilter(String status) {
        if (status != null) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Public job status filter is not supported");
        }
    }
}
