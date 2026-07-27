package com.tttn.jobrecommendation.modules.statistics.dto.response;

public record PublicStatisticsResponse(
        long totalJobs,
        long totalCompanies,
        long totalStudents,
        long totalApplications
) {
}
