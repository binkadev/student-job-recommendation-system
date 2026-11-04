package com.tttn.jobrecommendation.modules.company.controller;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.company.dto.request.RecruitmentReportFilter;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyAnalyticsResponse.*;
import com.tttn.jobrecommendation.modules.company.service.CompanyAnalyticsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.Set;

@RestController @Validated @RequiredArgsConstructor
@org.springframework.context.annotation.Profile("!no-db")
@RequestMapping("/api/companies/me") @PreAuthorize("hasRole('COMPANY')")
public class CompanyAnalyticsController {
    private final CompanyAnalyticsService analytics;
    private final SecurityUtils security;
    private void validate(MultiValueMap<String, String> params, Set<String> allowed) {
        if (params.entrySet().stream().anyMatch(e -> !allowed.contains(e.getKey()) || e.getValue().size() != 1)) throw new AppException(ErrorCode.BAD_REQUEST, "Unsupported or duplicate query parameter");
    }
    @GetMapping("/dashboard-summary")
    public ApiResponse<Dashboard> dashboard(@RequestParam(defaultValue = "30") @Pattern(regexp = "7|30|90") String days,
                                            @RequestParam MultiValueMap<String, String> params) {
        validate(params, Set.of("days"));
        return ApiResponse.success(analytics.dashboard(security.getCurrentUserId(), Integer.parseInt(days)));
    }
    @GetMapping("/recruitment-report")
    public ApiResponse<Report> report(@Valid @ModelAttribute RecruitmentReportFilter filter, @RequestParam MultiValueMap<String, String> params) {
        validate(params, Set.of("from", "to", "jobId", "status", "keyword", "page", "size"));
        return ApiResponse.success(analytics.report(security.getCurrentUserId(), filter));
    }
    @GetMapping("/recruitment-report/export")
    public ApiResponse<Export> export(@Valid @ModelAttribute RecruitmentReportFilter filter, @RequestParam MultiValueMap<String, String> params) {
        validate(params, Set.of("from", "to", "jobId", "status", "keyword"));
        return ApiResponse.success(analytics.export(security.getCurrentUserId(), filter));
    }
}
