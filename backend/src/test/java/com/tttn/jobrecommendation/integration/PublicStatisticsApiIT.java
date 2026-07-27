package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserStatus;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicStatisticsApiIT extends AbstractPostgresWebIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void anonymousEmptyDatabaseReturnsExactApiResponseContract() throws Exception {
        String body = mockMvc.perform(get("/api/public/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.errorCode").isEmpty())
                .andExpect(jsonPath("$.data.totalJobs").value(0))
                .andExpect(jsonPath("$.data.totalCompanies").value(0))
                .andExpect(jsonPath("$.data.totalStudents").value(0))
                .andExpect(jsonPath("$.data.totalApplications").value(0))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode response = objectMapper.readTree(body);
        assertThat(fieldNames(response))
                .containsExactlyInAnyOrder("success", "message", "errorCode", "data");
        assertThat(fieldNames(response.get("data")))
                .containsExactlyInAnyOrder(
                        "totalJobs",
                        "totalCompanies",
                        "totalStudents",
                        "totalApplications"
                );
        assertThat(body)
                .doesNotContain(
                        "passwordHash",
                        "filePath",
                        "storedFileName",
                        "storageDirectory",
                        "absolutePath",
                        "jobCount",
                        "companyCount",
                        "candidateCount",
                        "applicationCount"
                );
    }

    @Test
    void onlyExactGetStatisticsRouteIsPublic() throws Exception {
        mockMvc.perform(post("/api/public/statistics"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/students/me/cv"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/students/me/recommendation-runs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void activeJobsOfVerifiedCompanyWithNullTodayOrFutureDeadlineAreCounted() throws Exception {
        Company company = createCompany(
                "visible-statistics@example.test",
                "Visible Statistics",
                CompanyStatus.VERIFIED
        );
        createJobWithDeadline(company, "No deadline", JobStatus.ACTIVE, null);
        createJobWithDeadline(company, "Today", JobStatus.ACTIVE, LocalDate.now());
        createJobWithDeadline(company, "Future", JobStatus.ACTIVE, LocalDate.now().plusDays(1));

        assertCounts(3, 1, 0, 0);
    }

    @Test
    void activeExpiredJobIsNotCounted() throws Exception {
        Company company = createCompany(
                "expired-statistics@example.test",
                "Expired Statistics",
                CompanyStatus.VERIFIED
        );
        createJobWithDeadline(company, "Expired deadline", JobStatus.ACTIVE, LocalDate.now().minusDays(1));

        assertCounts(0, 1, 0, 0);
    }

    @ParameterizedTest
    @EnumSource(
            value = JobStatus.class,
            names = {"DRAFT", "PENDING_APPROVAL", "CLOSED", "REJECTED", "EXPIRED"}
    )
    void nonActiveJobStatusesAreNotCounted(JobStatus status) throws Exception {
        Company company = createCompany(
                "job-status-" + status.name().toLowerCase() + "@example.test",
                "Job Status Statistics",
                CompanyStatus.VERIFIED
        );
        createJobWithDeadline(company, status.name(), status, null);

        assertCounts(0, 1, 0, 0);
    }

    @ParameterizedTest
    @EnumSource(value = CompanyStatus.class, names = {"PENDING", "BLOCKED"})
    void activeJobsOfNonVerifiedCompaniesAreNotCounted(CompanyStatus status) throws Exception {
        Company company = createCompany(
                "company-status-" + status.name().toLowerCase() + "@example.test",
                "Hidden Company Statistics",
                status
        );
        createJobWithDeadline(company, "Hidden active job", JobStatus.ACTIVE, null);

        assertCounts(0, 0, 0, 0);
    }

    @Test
    void onlyVerifiedCompaniesAreCounted() throws Exception {
        createCompany("verified-count@example.test", "Verified", CompanyStatus.VERIFIED);
        createCompany("pending-count@example.test", "Pending", CompanyStatus.PENDING);
        createCompany("blocked-count@example.test", "Blocked", CompanyStatus.BLOCKED);

        assertCounts(0, 1, 0, 0);
    }

    @Test
    void onlyStudentsWithActiveUsersAreCounted() throws Exception {
        createStudent("active-student-count@example.test");
        Student inactive = createStudent("inactive-student-count@example.test");
        inactive.getUser().setStatus(UserStatus.INACTIVE);
        userRepository.saveAndFlush(inactive.getUser());
        Student blocked = createStudent("blocked-student-count@example.test");
        blocked.getUser().setStatus(UserStatus.BLOCKED);
        userRepository.saveAndFlush(blocked.getUser());

        assertCounts(0, 0, 1, 0);
    }

    @Test
    void allApplicationsIncludingWithdrawnAreCounted() throws Exception {
        Company company = createCompany(
                "application-count@example.test",
                "Application Count",
                CompanyStatus.VERIFIED
        );
        Job visibleJob = createJobWithDeadline(company, "Visible application job", JobStatus.ACTIVE, null);
        Job hiddenJob = createJobWithDeadline(company, "Hidden application job", JobStatus.CLOSED, null);
        Student firstStudent = createStudent("first-application-count@example.test");
        Student secondStudent = createStudent("second-application-count@example.test");
        createApplication(firstStudent, visibleJob, null, ApplicationStatus.PENDING);
        createApplication(secondStudent, hiddenJob, null, ApplicationStatus.WITHDRAWN);

        assertCounts(1, 1, 2, 2);
    }

    @Test
    void aggregateQueryCountDoesNotGrowWithDataVolume() throws Exception {
        long emptyDatabaseQueries = measureStatisticsQueryCount();

        Company company = createCompany(
                "query-count-statistics@example.test",
                "Query Count Statistics",
                CompanyStatus.VERIFIED
        );
        for (int index = 0; index < 20; index++) {
            createJobWithDeadline(company, "Counted Job " + index, JobStatus.ACTIVE, null);
        }

        long populatedDatabaseQueries = measureStatisticsQueryCount();

        assertThat(emptyDatabaseQueries).isEqualTo(1);
        assertThat(populatedDatabaseQueries).isEqualTo(emptyDatabaseQueries);
    }

    private Job createJobWithDeadline(
            Company company,
            String title,
            JobStatus status,
            LocalDate deadline
    ) {
        Job job = createJob(company, title, status);
        job.setDeadline(deadline);
        return jobRepository.saveAndFlush(job);
    }

    private void assertCounts(
            long totalJobs,
            long totalCompanies,
            long totalStudents,
            long totalApplications
    ) throws Exception {
        mockMvc.perform(get("/api/public/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalJobs").value(totalJobs))
                .andExpect(jsonPath("$.data.totalCompanies").value(totalCompanies))
                .andExpect(jsonPath("$.data.totalStudents").value(totalStudents))
                .andExpect(jsonPath("$.data.totalApplications").value(totalApplications));
    }

    private long measureStatisticsQueryCount() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        mockMvc.perform(get("/api/public/statistics"))
                .andExpect(status().isOk());

        return statistics.getPrepareStatementCount();
    }

    private Set<String> fieldNames(JsonNode node) {
        Set<String> names = new HashSet<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }
}
