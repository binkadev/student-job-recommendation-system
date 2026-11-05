package com.tttn.jobrecommendation.modules.company.repository;

import com.tttn.jobrecommendation.modules.company.dto.request.RecruitmentReportFilter;
import com.tttn.jobrecommendation.modules.company.dto.response.CompanyAnalyticsResponse.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository @RequiredArgsConstructor
@org.springframework.context.annotation.Profile("!no-db")
public class CompanyAnalyticsRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private static final String SOURCE = " from applications a join jobs j on j.id=a.job_id join students s on s.id=a.student_id join users u on u.id=s.user_id left join cv_files cv on cv.id=a.cv_file_id ";
    private static final String COLUMNS = "a.id,a.student_id,u.full_name student_name,u.email student_email,j.id job_id,j.title job_title,a.status,a.applied_at,a.reviewed_at,cv.original_file_name cv_file_name";
    private record Query(String where, Map<String, Object> params) {}
    private Query query(long companyId, RecruitmentReportFilter filter) {
        var params = new java.util.HashMap<String, Object>(); params.put("companyId", companyId);
        var where = new StringBuilder(" where j.company_id=:companyId");
        if (filter.getJobId() != null) { where.append(" and j.id=:jobId"); params.put("jobId", filter.getJobId()); }
        if (filter.getStatus() != null) { where.append(" and a.status=:status"); params.put("status", filter.getStatus().name()); }
        if (filter.getFrom() != null) { where.append(" and a.applied_at>=:from"); params.put("from", filter.getFrom().atStartOfDay()); }
        if (filter.getTo() != null) { where.append(" and a.applied_at<:until"); params.put("until", filter.getTo().plusDays(1).atStartOfDay()); }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            where.append(" and (u.full_name ilike :keyword escape '\\' or u.email ilike :keyword escape '\\' or j.title ilike :keyword escape '\\' or cv.original_file_name ilike :keyword escape '\\')");
            params.put("keyword", "%" + filter.getKeyword().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
        }
        return new Query(where.toString(), params);
    }
    public boolean ownsJob(long companyId, long jobId) {
        return jdbc.queryForObject("select count(*) from jobs where id=:id and company_id=:companyId", Map.of("id", jobId, "companyId", companyId), Long.class) == 1;
    }
    public Summary summary(long companyId, RecruitmentReportFilter filter) {
        Query q = query(companyId, filter);
        Map<String, Long> counts = new LinkedHashMap<>();
        for (var status : com.tttn.jobrecommendation.common.enums.ApplicationStatus.values()) counts.put(status.name(), 0L);
        jdbc.query("select a.status,count(*) n" + SOURCE + q.where + " group by a.status", q.params,
                (RowCallbackHandler) rs -> counts.put(rs.getString("status"), rs.getLong("n")));
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        long unique = jdbc.queryForObject("select count(distinct a.student_id)" + SOURCE + q.where, q.params, Long.class);
        return new Summary(total, unique, counts, rate(counts.get("ACCEPTED"), total));
    }
    public Map<String, Long> jobCounts(long companyId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (var status : com.tttn.jobrecommendation.common.enums.JobStatus.values()) counts.put(status.name(), 0L);
        jdbc.query("select status,count(*) n from jobs where company_id=:id group by status", Map.of("id", companyId),
                (RowCallbackHandler) rs -> counts.put(rs.getString("status"), rs.getLong("n")));
        return counts;
    }
    public List<Trend> trend(long companyId, RecruitmentReportFilter filter, boolean daily) {
        Query q = query(companyId, filter);
        String bucket = daily ? "to_char(a.applied_at,'YYYY-MM-DD')" : "to_char(a.applied_at,'YYYY-MM')";
        return jdbc.query("select " + bucket + " bucket,count(*) n" + SOURCE + q.where + " group by 1 order by 1", q.params,
                (rs, row) -> new Trend(rs.getString("bucket"), rs.getLong("n")));
    }
    public List<Performance> topJobs(long companyId, RecruitmentReportFilter filter) {
        Query q = query(companyId, filter);
        return jdbc.query("select j.id,j.title,count(*) n,count(*) filter(where a.status='ACCEPTED') accepted" + SOURCE + q.where
                        + " group by j.id,j.title order by n desc,j.id asc limit 10", q.params,
                (rs, row) -> new Performance(rs.getLong("id"), rs.getString("title"), rs.getLong("n"), rs.getLong("accepted"), rate(rs.getLong("accepted"), rs.getLong("n"))));
    }
    private static final RowMapper<Detail> DETAIL = (rs, row) -> new Detail(rs.getLong("id"), rs.getLong("student_id"),
            rs.getString("student_name"), rs.getString("student_email"), rs.getLong("job_id"), rs.getString("job_title"),
            rs.getString("status"), rs.getObject("applied_at", LocalDateTime.class), rs.getObject("reviewed_at", LocalDateTime.class), rs.getString("cv_file_name"));
    public List<Detail> details(long companyId, RecruitmentReportFilter filter) {
        Query q = query(companyId, filter);
        q.params.put("limit", filter.getSize()); q.params.put("offset", ((long) filter.getPage() - 1) * filter.getSize());
        return jdbc.query("select " + COLUMNS + SOURCE + q.where + " order by a.applied_at desc,a.id desc limit :limit offset :offset", q.params, DETAIL);
    }
    public void export(long companyId, RecruitmentReportFilter filter, java.util.function.Consumer<Detail> consumer) {
        Query q = query(companyId, filter);
        jdbc.query("select " + COLUMNS + SOURCE + q.where + " order by a.applied_at desc,a.id desc", q.params,
                (RowCallbackHandler) rs -> consumer.accept(DETAIL.mapRow(rs, 0)));
    }
    public long expiringCount(long companyId, LocalDate today) {
        return jdbc.queryForObject("select count(*) from jobs where company_id=:id and status='ACTIVE' and deadline between :today and :until",
                Map.of("id", companyId, "today", today, "until", today.plusDays(14)), Long.class);
    }
    public List<ExpiringJob> expiring(long companyId, LocalDate today) {
        return jdbc.query("select id,title,deadline from jobs where company_id=:id and status='ACTIVE' and deadline between :today and :until order by deadline,id limit 5",
                Map.of("id", companyId, "today", today, "until", today.plusDays(14)),
                (rs, row) -> new ExpiringJob(rs.getLong("id"), rs.getString("title"), rs.getObject("deadline", LocalDate.class)));
    }
    public static BigDecimal rate(long accepted, long total) {
        return total == 0 ? null : BigDecimal.valueOf(accepted).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }
}
