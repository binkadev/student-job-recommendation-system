package com.tttn.jobrecommendation.modules.company.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.company.dto.request.RecruitmentReportFilter;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyAnalyticsResponse.*;
import com.tttn.jobrecommendation.modules.company.repository.CompanyAnalyticsRepository;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
@org.springframework.context.annotation.Profile("!no-db")
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class CompanyAnalyticsService {
    private final CompanyRepository companies;
    private final CompanyAnalyticsRepository analytics;
    private long company(long userId, RecruitmentReportFilter filter) {
        long id = companies.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Company not found")).getId();
        if (filter.getJobId() != null && !analytics.ownsJob(id, filter.getJobId())) throw new ResourceNotFoundException("Job not found");
        return id;
    }
    private Scope scope(RecruitmentReportFilter filter) {
        return new Scope(filter.getFrom(), filter.getTo(), filter.getJobId(), filter.getStatus() == null ? null : filter.getStatus().name(),
                filter.getKeyword() == null || filter.getKeyword().isBlank() ? null : filter.getKeyword().trim(), "UTC");
    }
    private PageResponse<Detail> page(long id, RecruitmentReportFilter filter, long total) {
        return new PageResponse<>(analytics.details(id, filter), filter.getPage(), filter.getSize(), total, (int) Math.ceil((double) total / filter.getSize()));
    }
    public Report report(long userId, RecruitmentReportFilter filter) {
        long id = company(userId, filter); Summary summary = analytics.summary(id, filter);
        return new Report(scope(filter), summary, analytics.trend(id, filter, false), analytics.topJobs(id, filter), 10, page(id, filter, summary.totalApplications()));
    }
    public Dashboard dashboard(long userId, int days) {
        var filter = new RecruitmentReportFilter(); long id = company(userId, filter);
        Summary summary = analytics.summary(id, filter); Map<String, Long> jobs = analytics.jobCounts(id);
        LocalDate today = LocalDate.now(ZoneOffset.UTC), from = today.minusDays(days - 1);
        var trendFilter = new RecruitmentReportFilter(); trendFilter.setFrom(from); trendFilter.setTo(today);
        var byDay = analytics.trend(id, trendFilter, true).stream().collect(Collectors.toMap(Trend::bucket, Trend::applications));
        List<Trend> trend = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) trend.add(new Trend(day.toString(), byDay.getOrDefault(day.toString(), 0L)));
        filter.setSize(5);
        return new Dashboard(summary, jobs, jobs.values().stream().mapToLong(Long::longValue).sum(), "UTC", from, today, trend,
                analytics.topJobs(id, filter), analytics.expiringCount(id, today), analytics.expiring(id, today), page(id, filter, summary.totalApplications()));
    }
    public Export export(long userId, RecruitmentReportFilter filter) {
        long id = company(userId, filter); long total = analytics.summary(id, filter).totalApplications();
        if (total > 10000) throw new AppException(ErrorCode.REPORT_EXPORT_LIMIT_EXCEEDED, "Export exceeds 10000 rows; narrow the report filters");
        var csv = new StringBuilder("\uFEFFapplicationId,studentId,studentName,studentEmail,jobId,jobTitle,status,appliedAt,reviewedAt,cvFileName\r\n");
        analytics.export(id, filter, row -> {
            Object[] cells = { row.id(), row.studentId(), row.studentName(), row.studentEmail(), row.jobId(), row.jobTitle(), row.status(), row.appliedAt(), row.reviewedAt(), row.cvFileName() };
            for (int i = 0; i < cells.length; i++) { if (i > 0) csv.append(','); csv.append(csvCell(cells[i])); }
            csv.append("\r\n");
        });
        return new Export(scope(filter), total, "UTF-8", 10000, csv.toString());
    }
    static String csvCell(Object value) {
        String text = value == null ? "" : value.toString(), leading = text.stripLeading();
        if ((!leading.isEmpty() && "=+-@".indexOf(leading.charAt(0)) >= 0) || text.startsWith("\t") || text.startsWith("\r") || text.startsWith("\n")) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
