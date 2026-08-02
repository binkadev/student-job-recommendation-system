package com.tttn.jobrecommendation.modules.candidateranking.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.candidateranking.dto.request.CreateCandidateRankingRunRequest;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunDetailResponse;
import com.tttn.jobrecommendation.modules.candidateranking.dto.response.CandidateRankingRunResponse;
import com.tttn.jobrecommendation.modules.candidateranking.service.CandidateRankingPublicService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Candidate Ranking")
@Validated
@RestController
@RequestMapping("/api/companies/me/jobs/{jobId}/candidate-ranking-runs")
@PreAuthorize("hasRole('COMPANY')")
@RequiredArgsConstructor
public class CandidateRankingController {

    private final CandidateRankingPublicService publicService;
    private final SecurityUtils securityUtils;

    @Operation(summary = "Create a candidate ranking run for a current-company job")
    @PostMapping
    public ApiResponse<CandidateRankingRunDetailResponse> createRun(
            @PathVariable Long jobId,
            @Valid @RequestBody CreateCandidateRankingRunRequest request
    ) {
        return ApiResponse.success(publicService.createRun(
                securityUtils.getCurrentUserId(),
                jobId,
                request
        ));
    }

    @Operation(summary = "List candidate ranking runs for a current-company job")
    @GetMapping
    public ApiResponse<PageResponse<CandidateRankingRunResponse>> getRuns(
            @PathVariable Long jobId,
            @RequestParam(defaultValue = "1") @Min(1) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size
    ) {
        return ApiResponse.success(publicService.getRuns(
                securityUtils.getCurrentUserId(),
                jobId,
                page,
                size
        ));
    }

    @Operation(summary = "Get one candidate ranking run for a current-company job")
    @GetMapping("/{runId}")
    public ApiResponse<CandidateRankingRunDetailResponse> getRunDetail(
            @PathVariable Long jobId,
            @PathVariable Long runId
    ) {
        return ApiResponse.success(publicService.getRunDetail(
                securityUtils.getCurrentUserId(),
                jobId,
                runId
        ));
    }
}
