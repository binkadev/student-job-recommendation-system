package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CompanyAnalyticsApiIT extends AbstractPostgresWebIntegrationTest {
    @Autowired ObjectMapper mapper;
    private Company a, b;
    private long firstJob;
    @BeforeEach void fixtures() {
        a = createCompany("analytics-owner@test.invalid", "Owner", CompanyStatus.BLOCKED);
        b = createCompany("analytics-foreign@test.invalid", "Foreign", CompanyStatus.PENDING);
        CompanyAnalyticsFixtures.seed(jdbcTemplate, a.getId(), "own");
        CompanyAnalyticsFixtures.seed(jdbcTemplate, b.getId(), "foreign");
        firstJob = jdbcTemplate.queryForObject("select min(id) from jobs where company_id=?", Long.class, a.getId());
    }
    private JsonNode read(String endpoint, Company company) throws Exception {
        return mapper.readTree(mockMvc.perform(get("/api/companies/me/" + endpoint).header("Authorization", bearerToken(company.getUser())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
    }
    @Test void allTimeCountsIncludeEveryHistoryAndOwnedJobRegardlessOfVerification() throws Exception {
        for (Company company : List.of(a, b)) {
            JsonNode data = read("dashboard-summary?days=90", company);
            assertThat(data.get("totalJobs").asLong()).isEqualTo(130);
            assertThat(data.at("/summary/totalApplications").asLong()).isEqualTo(362);
            assertThat(data.at("/summary/uniqueStudents").asLong()).isEqualTo(360);
            assertThat(data.at("/summary/acceptedRate").asDouble()).isEqualTo(19.89);
            for (String s : List.of("PENDING", "REVIEWED", "ACCEPTED", "WITHDRAWN")) assertThat(data.at("/summary/statusCounts/" + s).asLong()).isEqualTo(72);
            assertThat(data.at("/summary/statusCounts/REJECTED").asLong()).isEqualTo(74);
            long statusSum = 0; for (JsonNode n : data.at("/summary/statusCounts")) statusSum += n.asLong();
            assertThat(statusSum).isEqualTo(362);
            assertThat(data.get("trend")).hasSize(90);
            for (JsonNode day : data.get("trend")) assertThat(day.get("applications").asLong()).isEqualTo(4);
            assertThat(data.get("expiringJobCount").asLong()).isEqualTo(22);
            assertThat(data.get("expiringJobs")).hasSize(5);
            assertThat(data.at("/recentApplications/items")).hasSize(5);
            assertThat(data.at("/recentApplications/totalItems").asLong()).isEqualTo(362);
            assertThat(data.at("/topJobs/0/applications").asLong()).isEqualTo(5);
            assertThat(data.at("/topJobs/0/jobId").asLong()).isEqualTo(jdbcTemplate.queryForObject("select min(id) from jobs where company_id=?", Long.class, company.getId()));
        }
    }
    @Test void exactFiltersTrendAndPaginationAgreeWithIndependentSql() throws Exception {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        JsonNode data = read("recruitment-report?from=" + today.minusDays(29) + "&to=" + today + "&status=REVIEWED&size=7&page=2", a);
        long expected = jdbcTemplate.queryForObject("select count(*) from applications where job_id in(select id from jobs where company_id=?) and status='REVIEWED' and applied_at>=? and applied_at<?", Long.class, a.getId(), today.minusDays(29).atStartOfDay(), today.plusDays(1).atStartOfDay());
        assertThat(expected).isEqualTo(24);
        assertThat(data.at("/summary/totalApplications").asLong()).isEqualTo(expected);
        assertThat(data.at("/applications/totalItems").asLong()).isEqualTo(expected);
        assertThat(data.at("/applications/totalPages").asInt()).isEqualTo(4);
        assertThat(data.at("/applications/items")).hasSize(7);
        long trendSum = 0; for (JsonNode bucket : data.get("trend")) trendSum += bucket.get("applications").asLong();
        assertThat(trendSum).isEqualTo(expected);
        JsonNode job = read("recruitment-report?jobId=" + firstJob + "&status=REJECTED", a);
        assertThat(job.at("/summary/totalApplications").asLong()).isEqualTo(2);
        assertThat(job.at("/summary/uniqueStudents").asLong()).isEqualTo(1);
        String literal = mockMvc.perform(get("/api/companies/me/recruitment-report").param("keyword", "%").header("Authorization", bearerToken(a.getUser())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(literal).at("/data/summary/totalApplications").asLong()).isEqualTo(1);
        JsonNode empty = read("recruitment-report?from=2000-01-01&to=2000-01-31", a);
        assertThat(empty.at("/summary/totalApplications").asLong()).isZero();
        assertThat(empty.at("/summary/acceptedRate").isNull()).isTrue();
        assertThat(empty.at("/applications/totalPages").asInt()).isZero();
        assertThat(empty.get("trend")).isEmpty();
        JsonNode page1 = read("recruitment-report?size=100", a), page2 = read("recruitment-report?size=100&page=2", a);
        assertThat(page1.at("/applications/items")).hasSize(100);
        var ids = new java.util.HashSet<Long>();
        for (JsonNode item : page1.at("/applications/items")) ids.add(item.get("id").asLong());
        for (JsonNode item : page2.at("/applications/items")) assertThat(ids.add(item.get("id").asLong())).isTrue();
    }
    @Test void utcDateBoundariesAreInclusiveAndTiedTimestampsHaveIdTieBreaker() throws Exception {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long id = jdbcTemplate.queryForObject("select min(id) from applications where job_id=?", Long.class, firstJob);
        jdbcTemplate.update("update applications set applied_at=? where id=?", today.atStartOfDay(), id);
        JsonNode data = read("recruitment-report?from=" + today + "&to=" + today, a);
        assertThat(data.at("/summary/totalApplications").asLong()).isEqualTo(4);
        jdbcTemplate.update("update applications set applied_at=? where id=?", today.plusDays(1).atStartOfDay(), id);
        assertThat(read("recruitment-report?from=" + today + "&to=" + today, a).at("/summary/totalApplications").asLong()).isEqualTo(3);
        var list = read("recruitment-report?size=100", a).at("/applications/items");
        for (int i = 1; i < list.size(); i++) {
            String previous = list.get(i - 1).get("appliedAt").asText(), current = list.get(i).get("appliedAt").asText();
            assertThat(previous.compareTo(current)).isGreaterThanOrEqualTo(0);
            if (previous.equals(current)) assertThat(list.get(i - 1).get("id").asLong()).isGreaterThan(list.get(i).get("id").asLong());
        }
    }
    @Test void validationAndOwnershipAreEnforcedBeforeReadingAnalytics() throws Exception {
        long foreign = jdbcTemplate.queryForObject("select min(id) from jobs where company_id=?", Long.class, b.getId());
        for (String endpoint : List.of("recruitment-report?jobId=" + foreign, "recruitment-report/export?jobId=" + foreign)) {
            mockMvc.perform(get("/api/companies/me/" + endpoint).header("Authorization", bearerToken(a.getUser())))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").isEmpty());
        }
        for (String query : List.of("jobId=0", "status=INVITED", "size=101", "page=0", "from=2026-02-01&to=2026-01-01", "from=no-date", "companyId=2", "sort=id", "page=1&page=2")) {
            mockMvc.perform(get("/api/companies/me/recruitment-report?" + query).header("Authorization", bearerToken(a.getUser())))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(get("/api/companies/me/dashboard-summary?days=14").header("Authorization", bearerToken(a.getUser()))).andExpect(status().isBadRequest());
        var student = createStudent("analytics-role@test.invalid");
        for (String path : List.of("dashboard-summary", "recruitment-report", "recruitment-report/export")) {
            mockMvc.perform(get("/api/companies/me/" + path)).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/companies/me/" + path).header("Authorization", bearerToken(student.getUser()))).andExpect(status().isForbidden());
        }
    }
    @Test void csvExportsFullFilteredDatasetSafelyWithoutWritingBusinessRows() throws Exception {
        String digest = jdbcTemplate.queryForObject("select md5(string_agg(to_jsonb(a)::text,'' order by id)) from applications a", String.class);
        JsonNode export = read("recruitment-report/export", a);
        assertThat(export.get("rowCount").asLong()).isEqualTo(362);
        String csv = export.get("csv").asText();
        assertThat(csv).startsWith("\uFEFFapplicationId,studentId");
        assertThat(csv).contains("\"'=SUM(1,1)\"", "tiếng Việt", "\"'+line\nsecond line\"");
        assertThat(csv).doesNotContain("Synthetic foreign", "@foreign");
        long lines = 0; boolean quoted = false;
        for (int i = 0; i < csv.length(); i++) { if (csv.charAt(i) == '"') quoted = !quoted; if (csv.charAt(i) == '\n' && !quoted) lines++; }
        assertThat(lines - 1).isEqualTo(362);
        assertThat(read("recruitment-report/export?jobId=" + firstJob + "&status=REJECTED", a).get("rowCount").asLong()).isEqualTo(2);
        read("dashboard-summary?days=7", a); read("recruitment-report", a);
        assertThat(jdbcTemplate.queryForObject("select md5(string_agg(to_jsonb(a)::text,'' order by id)) from applications a", String.class)).isEqualTo(digest);
    }
    @Test void exportRejectsOversizedDatasetWithoutSilentTruncation() throws Exception {
        jdbcTemplate.update("insert into applications(student_id,job_id,status,applied_at) select (select min(id) from students),?,'REJECTED',timestamp '2000-01-01' from generate_series(1,10000)", firstJob);
        mockMvc.perform(get("/api/companies/me/recruitment-report/export").header("Authorization", bearerToken(a.getUser())))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errorCode").value("REPORT_EXPORT_LIMIT_EXCEEDED"));
    }
}
