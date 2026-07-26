package com.tttn.jobrecommendation.modules.statistics.controller;

import com.tttn.jobrecommendation.common.response.ApiResponse;
import com.tttn.jobrecommendation.modules.statistics.dto.response.PublicStatisticsResponse;
import com.tttn.jobrecommendation.modules.statistics.service.PublicStatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Public Statistics")
@SecurityRequirements
@RestController
@RequestMapping("/api/public/statistics")
@RequiredArgsConstructor
public class PublicStatisticsController {

    private final PublicStatisticsService publicStatisticsService;

    @Operation(summary = "Get public platform statistics")
    @GetMapping
    public ApiResponse<PublicStatisticsResponse> getStatistics() {
        return ApiResponse.success(publicStatisticsService.getStatistics());
    }
}
