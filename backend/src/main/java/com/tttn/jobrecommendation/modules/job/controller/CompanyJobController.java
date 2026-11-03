package com.tttn.jobrecommendation.modules.job.controller;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.job.dto.request.JobFilterRequest;
import com.tttn.jobrecommendation.modules.job.dto.response.JobResponse;
import com.tttn.jobrecommendation.modules.job.service.JobService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/companies/me/jobs")
@PreAuthorize("hasRole('COMPANY')")
@RequiredArgsConstructor
public class CompanyJobController {
    private static final Set<String> FILTERS = Set.of("page", "size", "keyword", "status", "jobType", "workingModel", "location");
    private final JobService jobService;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ApiResponse<PageResponse<JobResponse>> getMyJobs(@Valid @ModelAttribute JobFilterRequest request,
                                                           @RequestParam Map<String, String> parameters) {
        if (!FILTERS.containsAll(parameters.keySet())) throw new AppException(ErrorCode.BAD_REQUEST, "Unsupported own-jobs filter");
        return ApiResponse.success(jobService.getMyJobs(request, securityUtils.getCurrentUserId()));
    }
}
