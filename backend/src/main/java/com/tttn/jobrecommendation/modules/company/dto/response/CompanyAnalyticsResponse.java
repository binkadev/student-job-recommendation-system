package com.tttn.jobrecommendation.modules.company.dto.response;

import com.tttn.jobrecommendation.common.response.PageResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class CompanyAnalyticsResponse {
    private CompanyAnalyticsResponse() {}
    public record Summary(long totalApplications, long uniqueStudents, Map<String, Long> statusCounts, BigDecimal acceptedRate) {}
    public record Scope(LocalDate from, LocalDate to, Long jobId, String status, String keyword, String timeZone) {}
    public record Trend(String bucket, long applications) {}
    public record Performance(long jobId, String jobTitle, long applications, long accepted, BigDecimal acceptedRate) {}
    public record Detail(long id, long studentId, String studentName, String studentEmail, long jobId,
                         String jobTitle, String status, LocalDateTime appliedAt, LocalDateTime reviewedAt, String cvFileName) {}
    public record ExpiringJob(long jobId, String jobTitle, LocalDate deadline) {}
    public record Report(Scope scope, Summary summary, List<Trend> trend, List<Performance> topJobs,
                         int topJobLimit, PageResponse<Detail> applications) {}
    public record Dashboard(Summary summary, Map<String, Long> jobCounts, long totalJobs,
                            String timeZone, LocalDate trendFrom, LocalDate trendTo, List<Trend> trend,
                            List<Performance> topJobs, long expiringJobCount, List<ExpiringJob> expiringJobs,
                            PageResponse<Detail> recentApplications) {}
    public record Export(Scope scope, long rowCount, String encoding, int maxRows, String csv) {}
}
