package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CompanyOwnJobsApiIT extends AbstractPostgresWebIntegrationTest {
    private static final String URL = "/api/companies/me/jobs";
    @Autowired ObjectMapper mapper;
    private Company a, b;
    private List<Job> jobsA, jobsB;

    @BeforeEach void seedTwoLargeCompanies() {
        a = createCompany("own-a@example.test", "Owner A", CompanyStatus.VERIFIED);
        b = createCompany("own-b@example.test", "Owner B", CompanyStatus.VERIFIED);
        jobsA = seed(a); jobsB = seed(b);
        // All rows have identical creation timestamps, forcing the ID tie-break.
        jdbcTemplate.update("UPDATE jobs SET created_at = TIMESTAMP '2026-11-01 08:00:00'");
    }
    private List<Job> seed(Company company) {
        List<Job> jobs = new ArrayList<>();
        for (int i = 0; i < 130; i++) jobs.add(Job.builder().company(company).title((i % 5 == 0 ? "needle" : "ordinary") + " role " + i)
                .description("Synthetic owned-query PostgreSQL fixture").requirements("Java and Git").location(i % 2 == 0 ? "Hà Nội" : "Đà Nẵng")
                .status(JobStatus.values()[i % JobStatus.values().length]).jobType(JobType.values()[i % JobType.values().length])
                .workingModel(WorkingModel.values()[i % WorkingModel.values().length]).deadline(LocalDate.of(2099, 12, 31)).build());
        return jobRepository.saveAllAndFlush(jobs);
    }
    private JsonNode page(Company company, String query) throws Exception {
        var response = mockMvc.perform(get(URL + query).header("Authorization", bearerToken(company.getUser())))
                .andExpect(status().isOk()).andReturn().getResponse();
        return mapper.readTree(response.getContentAsString()).path("data");
    }
    private List<Long> ids(JsonNode page) {
        List<Long> ids = new ArrayList<>(); page.path("items").forEach(item -> ids.add(item.path("id").asLong())); return ids;
    }

    @Test void eachOwnerCanTraverseMoreThan100RowsWithExactCountsNoDuplicatesAndStableTies() throws Exception {
        for (Company owner : List.of(a, b)) {
            List<Job> fixtures = owner == a ? jobsA : jobsB;
            List<Long> expected = fixtures.stream().map(Job::getId).sorted(Comparator.reverseOrder()).toList();
            List<Long> seen = new ArrayList<>();
            for (int n = 1; n <= 8; n++) {
                JsonNode result = page(owner, "?page=" + n + "&size=17");
                assertThat(result.path("totalItems").asInt()).isEqualTo(130);
                assertThat(result.path("totalPages").asInt()).isEqualTo(8);
                assertThat(result.path("page").asInt()).isEqualTo(n); assertThat(result.path("size").asInt()).isEqualTo(17);
                for (JsonNode item : result.path("items")) assertThat(item.path("companyId").asLong()).isEqualTo(owner.getId());
                assertThat(ids(result)).containsExactlyElementsOf(expected.subList((n - 1) * 17, Math.min(n * 17, 130)));
                seen.addAll(ids(result));
            }
            assertThat(seen).hasSize(130).doesNotHaveDuplicates().containsExactlyElementsOf(expected);
            assertThat(ids(page(owner, "?page=1&size=100"))).hasSize(100);
            assertThat(ids(page(owner, "?page=2&size=100"))).hasSize(30);
            var out = page(owner, "?page=9&size=17");
            assertThat(ids(out)).isEmpty(); assertThat(out.path("page").asInt()).isEqualTo(9);
            assertThat(out.path("totalItems").asInt()).isEqualTo(130); assertThat(out.path("totalPages").asInt()).isEqualTo(8);
            var defaults = page(owner, ""); assertThat(defaults.path("size").asInt()).isEqualTo(10); assertThat(defaults.path("totalPages").asInt()).isEqualTo(13);
        }
    }

    @Test void filtersAreAppliedBeforeLimitAndCountForEveryStatusTypeAndModel() throws Exception {
        for (Company owner : List.of(a, b)) {
            List<Job> fixtures = owner == a ? jobsA : jobsB;
            for (JobStatus state : JobStatus.values()) assertFiltered(owner, "status=" + state, fixtures.stream().filter(j -> j.getStatus() == state).toList());
            for (JobType type : JobType.values()) assertFiltered(owner, "jobType=" + type, fixtures.stream().filter(j -> j.getJobType() == type).toList());
            for (WorkingModel model : WorkingModel.values()) assertFiltered(owner, "workingModel=" + model, fixtures.stream().filter(j -> j.getWorkingModel() == model).toList());
            assertFiltered(owner, "keyword=needle", fixtures.stream().filter(j -> j.getTitle().startsWith("needle")).toList());
            Job sample = fixtures.get(0);
            assertFiltered(owner, "keyword=needle&status=" + sample.getStatus() + "&jobType=" + sample.getJobType() + "&workingModel=" + sample.getWorkingModel(),
                    fixtures.stream().filter(j -> j.getTitle().startsWith("needle") && j.getStatus() == sample.getStatus() && j.getJobType() == sample.getJobType() && j.getWorkingModel() == sample.getWorkingModel()).toList());
            var empty = page(owner, "?keyword=does-not-exist&size=7");
            assertThat(ids(empty)).isEmpty(); assertThat(empty.path("totalItems").asInt()).isZero(); assertThat(empty.path("totalPages").asInt()).isZero();
        }
    }
    private void assertFiltered(Company owner, String filters, List<Job> expectedRows) throws Exception {
        var expected = expectedRows.stream().map(Job::getId).sorted(Comparator.reverseOrder()).toList();
        List<Long> all = new ArrayList<>(); int pages = (expected.size() + 6) / 7;
        for (int n = 1; n <= Math.max(1, pages); n++) {
            var result = page(owner, "?" + filters + "&page=" + n + "&size=7");
            assertThat(result.path("totalItems").asInt()).isEqualTo(expected.size());
            assertThat(result.path("totalPages").asInt()).isEqualTo(pages); all.addAll(ids(result));
        }
        assertThat(all).containsExactlyElementsOf(expected).doesNotHaveDuplicates();
    }

    @Test void rejectsOwnerSelectorsBadPaginationAndWrongRolesWithoutChangingGenericDiscovery() throws Exception {
        for (String query : List.of("?companyId=" + b.getId(), "?userId=" + b.getUser().getId(), "?sort=id,asc", "?page=0", "?size=0", "?size=101", "?page=abc", "?status=UNKNOWN"))
            mockMvc.perform(get(URL + query).header("Authorization", bearerToken(a.getUser()))).andExpect(status().isBadRequest());
        for (UserRole role : List.of(UserRole.STUDENT, UserRole.ADMIN)) {
            var user = createUser(role + "@example.test", role);
            mockMvc.perform(get(URL).header("Authorization", bearerToken(user))).andExpect(status().isForbidden());
        }
        Job internal = jobsA.stream().filter(j -> j.getStatus() == JobStatus.DRAFT).findFirst().orElseThrow();
        mockMvc.perform(get("/api/jobs/{id}", internal.getId()).header("Authorization", bearerToken(b.getUser()))).andExpect(status().isForbidden());
        mockMvc.perform(put("/api/jobs/{id}", internal.getId()).header("Authorization", bearerToken(b.getUser())).contentType("application/json").content("{\"title\":\"Foreign edit\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/jobs/{id}/status", internal.getId()).header("Authorization", bearerToken(b.getUser())).contentType("application/json").content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isForbidden());
        long visible = java.util.stream.Stream.concat(jobsA.stream(), jobsB.stream()).filter(j -> j.getStatus() == JobStatus.ACTIVE).count();
        mockMvc.perform(get("/api/public/jobs?size=100")).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(visible));
        mockMvc.perform(get("/api/public/jobs/{id}", internal.getId())).andExpect(status().isNotFound());
        // Generic Company discovery still permits VERIFIED foreign ACTIVE jobs.
        var generic = mockMvc.perform(get("/api/jobs?size=100").header("Authorization", bearerToken(a.getUser()))).andExpect(status().isOk()).andReturn();
        var data = mapper.readTree(generic.getResponse().getContentAsString()).path("data");
        assertThat(data.path("totalItems").asInt()).isEqualTo(130 + (int) jobsB.stream().filter(j -> j.getStatus() == JobStatus.ACTIVE).count());
    }

    @Test void pendingAndBlockedCompaniesKeepAllOwnStatesButCannotPublishAndAreHiddenPublicly() throws Exception {
        var student = createStudent("discovery@example.test");
        for (CompanyStatus state : List.of(CompanyStatus.PENDING, CompanyStatus.BLOCKED)) {
            a.setStatus(state); companyRepository.saveAndFlush(a);
            assertThat(page(a, "?size=100").path("totalItems").asInt()).isEqualTo(130);
            var drafts = page(a, "?status=DRAFT"); assertThat(drafts.path("totalItems").asInt()).isPositive();
            long draft = ids(drafts).getFirst();
            mockMvc.perform(patch("/api/jobs/{id}/status", draft).header("Authorization", bearerToken(a.getUser())).contentType("application/json").content("{\"status\":\"PENDING_APPROVAL\"}"))
                    .andExpect(status().isForbidden());
            mockMvc.perform(patch("/api/jobs/{id}/status", draft).header("Authorization", bearerToken(a.getUser())).contentType("application/json").content("{\"status\":\"ACTIVE\"}"))
                    .andExpect(status().isForbidden());
            long active = jobsA.stream().filter(j -> j.getStatus() == JobStatus.ACTIVE).findFirst().orElseThrow().getId();
            mockMvc.perform(get("/api/public/jobs/{id}", active)).andExpect(status().isNotFound());
            mockMvc.perform(get("/api/jobs/{id}", active).header("Authorization", bearerToken(student.getUser()))).andExpect(status().isForbidden());
        }
    }

    @Test void createAndCloseAreReflectedInDatabaseFilteredCounts() throws Exception {
        int initial = page(a, "?status=DRAFT").path("totalItems").asInt();
        var created = mockMvc.perform(post("/api/jobs").header("Authorization", bearerToken(a.getUser())).contentType("application/json")
                        .content("{\"title\":\"New owned draft\",\"description\":\"Synthetic\",\"jobType\":\"INTERNSHIP\",\"workingModel\":\"HYBRID\"}"))
                .andExpect(status().isOk()).andReturn();
        long id = mapper.readTree(created.getResponse().getContentAsString()).path("data").path("id").asLong();
        var after = page(a, "?status=DRAFT"); assertThat(after.path("totalItems").asInt()).isEqualTo(initial + 1); assertThat(ids(after).getFirst()).isEqualTo(id);
        mockMvc.perform(delete("/api/jobs/{id}", id).header("Authorization", bearerToken(a.getUser()))).andExpect(status().isOk());
        assertThat(page(a, "?status=DRAFT").path("totalItems").asInt()).isEqualTo(initial);
        assertThat(ids(page(a, "?status=CLOSED"))).contains(id);
    }
}
