package com.tttn.jobrecommendation.integration;

import org.springframework.jdbc.core.JdbcTemplate;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/** Large synthetic fixtures ONLY for disposable Testcontainers. Never invoked by runtime code. */
public final class CompanyAnalyticsFixtures {
    private CompanyAnalyticsFixtures() {}
    public static void seed(JdbcTemplate jdbc, long companyId, String namespace) {
        jdbc.update("""
                insert into jobs(company_id,title,description,job_type,working_model,status,deadline)
                select ?, ? || g, 'Synthetic analytics',
                (array['FULL_TIME','PART_TIME','INTERNSHIP','CONTRACT'])[g%4+1], 'REMOTE',
                (array['DRAFT','PENDING_APPROVAL','ACTIVE','CLOSED','REJECTED','EXPIRED'])[g%6+1], ?::date
                from generate_series(0,129) g
                """, companyId, "Analytics " + namespace + " ", LocalDate.now(ZoneOffset.UTC).plusDays(5));
        jdbc.update("""
                insert into users(email,password_hash,full_name,role,status)
                select ? || g || '@analytics.invalid', 'not-a-login-credential',
                case when g=0 then '=SUM(1,1)' when g=1 then 'Literal %_\\ tiếng Việt' when g=2 then '+line' || chr(10) || 'second line' else ? || g end,
                'STUDENT','ACTIVE' from generate_series(0,359) g
                """, namespace + "-", "Synthetic " + namespace + " ");
        jdbc.update("insert into students(user_id) select id from users where email like ? order by id", namespace + "-%@analytics.invalid");
        List<Long> students = jdbc.queryForList("select s.id from students s join users u on u.id=s.user_id where u.email like ? order by s.id", Long.class, namespace + "-%@analytics.invalid");
        List<Long> jobs = jdbc.queryForList("select id from jobs where company_id=? order by id", Long.class, companyId);
        var values = new ArrayList<Object[]>();
        String[] statuses = {"PENDING", "REVIEWED", "ACCEPTED", "REJECTED", "WITHDRAWN"};
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int i = 0; i < 360; i++) values.add(new Object[]{ students.get(i), jobs.get(i % 130), statuses[i % 5], Timestamp.valueOf(today.minusDays(i % 90).atTime(12, 0)) });
        // Two prior REJECTED histories followed by the existing PENDING row are a valid V18 reapply history.
        for (int i = 99; i <= 100; i++) values.add(new Object[]{ students.getFirst(), jobs.getFirst(), "REJECTED", Timestamp.valueOf(today.minusDays(i).atStartOfDay()) });
        jdbc.batchUpdate("insert into applications(student_id,job_id,status,applied_at) values (?,?,?,?)", values);
    }
}
