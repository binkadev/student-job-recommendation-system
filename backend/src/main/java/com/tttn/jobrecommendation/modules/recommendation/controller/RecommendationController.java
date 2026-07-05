package com.tttn.jobrecommendation.modules.recommendation.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.common.utils.SecurityUtils;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunResponse;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/students/me")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationQueryService recommendationQueryService;
    private final SecurityUtils securityUtils;

    @GetMapping("/recommendation-runs")
    public ApiResponse<List<RecommendationRunResponse>> getMyRecommendationRuns() {
        return ApiResponse.success(recommendationQueryService.getMyRecommendationRuns(securityUtils.getCurrentUserId()));
    }

    @GetMapping("/recommendation-results/latest")
    public ApiResponse<List<RecommendationResultResponse>> getLatestRecommendationResults() {
        return ApiResponse.success(recommendationQueryService.getLatestRecommendationResults(securityUtils.getCurrentUserId()));
    }
}
