package com.tttn.jobrecommendation.modules.company.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PublicStatisticsResponse {

    private long totalJobs;
    private long jobCount;
    private long totalCompanies;
    private long companyCount;
    private long totalCandidates;
    private long candidateCount;
    private long totalStudents;
    private long studentCount;
    private long totalApplications;
    private long applicationCount;
    private long applications;
}
