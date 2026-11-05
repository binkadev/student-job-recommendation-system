package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.awaitility.Awaitility.await;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class JobModerationApiIT extends AbstractPostgresWebIntegrationTest {
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PlatformTransactionManager transactionManager;

    private static final Set<String> COMMON_EDGES = Set.of(
            "DRAFT>PENDING_APPROVAL", "PENDING_APPROVAL>DRAFT", "REJECTED>DRAFT", "CLOSED>DRAFT", "EXPIRED>DRAFT",
            "DRAFT>CLOSED", "PENDING_APPROVAL>CLOSED", "ACTIVE>CLOSED", "REJECTED>CLOSED", "EXPIRED>CLOSED",
            "DRAFT>DRAFT", "CLOSED>CLOSED", "PENDING_APPROVAL>PENDING_APPROVAL");
    private static final Set<String> ADMIN_EDGES = Set.of(
            "PENDING_APPROVAL>ACTIVE", "PENDING_APPROVAL>REJECTED", "ACTIVE>EXPIRED",
            "ACTIVE>ACTIVE", "REJECTED>REJECTED", "EXPIRED>EXPIRED");

    @Test
    void registrationIsPendingAndCannotSelfVerifyOrPublish() throws Exception {
        String email = "pending-registration@example.test";
        var result = mockMvc.perform(post("/api/auth/register").contentType("application/json").content(objectMapper.writeValueAsString(Map.of(
                "email", email, "password", "Integration-only-Password!42", "role", "COMPANY", "companyName", "Pending Registration"))))
                .andExpect(status().isCreated()).andReturn();
        long userId = objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asLong();
        Company company = companyRepository.findByUserId(userId).orElseThrow();
        assertThat(company.getStatus()).isEqualTo(CompanyStatus.PENDING);
        User owner = userRepository.findById(userId).orElseThrow();
        String token = bearerToken(owner);
        mockMvc.perform(post("/api/jobs").header("Authorization", token).contentType("application/json").content(jobBody("DRAFT")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT"));
        mockMvc.perform(post("/api/jobs").header("Authorization", token).contentType("application/json").content(jobBody("ACTIVE")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/jobs").header("Authorization", token).contentType("application/json").content(jobBody("PENDING_APPROVAL")))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/admin/companies/{id}/status", company.getId()).header("Authorization", token)
                .contentType("application/json").content("{\"status\":\"VERIFIED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void everyRoleCompanyStatusAndJobTransitionMatchesThePolicy() throws Exception {
        User admin = createUser("matrix-admin@example.test", UserRole.ADMIN);
        for (CompanyStatus companyStatus : CompanyStatus.values()) {
            Company company = createCompany(companyStatus + "@example.test", "Matrix " + companyStatus, companyStatus);
            for (User actor : List.of(company.getUser(), admin)) {
                for (JobStatus from : JobStatus.values()) {
                    for (JobStatus to : JobStatus.values()) {
                        Job job = createJob(company, "Transition matrix", from);
                        int expected = expectedTransition(actor.getRole(), companyStatus, from, to);
                        mockMvc.perform(patch("/api/jobs/{id}/status", job.getId()).header("Authorization", bearerToken(actor))
                                        .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("status", to))))
                                .andExpect(status().is(expected));
                        assertThat(jobRepository.findById(job.getId()).orElseThrow().getStatus())
                                .as("%s %s %s -> %s", actor.getRole(), companyStatus, from, to)
                                .isEqualTo(expected == 200 ? to : from);
                    }
                }
            }
        }
    }

    @Test
    void companyAndStudentCannotUseOtherOwnersOrAdminActions() throws Exception {
        Company owner = createCompany("owner@example.test", "Owner", CompanyStatus.VERIFIED);
        Company other = createCompany("other@example.test", "Other", CompanyStatus.VERIFIED);
        User student = createStudent("student@example.test").getUser();
        Job pending = createJob(owner, "Owned pending", JobStatus.PENDING_APPROVAL);
        for (User actor : List.of(other.getUser(), student)) {
            String token = bearerToken(actor);
            mockMvc.perform(put("/api/jobs/{id}", pending.getId()).header("Authorization", token)
                    .contentType("application/json").content("{\"title\":\"Forbidden edit\"}")).andExpect(status().isForbidden());
            mockMvc.perform(patch("/api/jobs/{id}/status", pending.getId()).header("Authorization", token)
                    .contentType("application/json").content("{\"status\":\"ACTIVE\"}")).andExpect(status().isForbidden());
            mockMvc.perform(delete("/api/jobs/{id}", pending.getId()).header("Authorization", token)).andExpect(status().isForbidden());
            mockMvc.perform(patch("/api/admin/companies/{id}/status", owner.getId()).header("Authorization", token)
                    .contentType("application/json").content("{\"status\":\"VERIFIED\"}")).andExpect(status().isForbidden());
        }
        mockMvc.perform(post("/api/jobs").header("Authorization", bearerToken(student)).contentType("application/json")
                .content(jobBody("DRAFT"))).andExpect(status().isForbidden());
    }

    @Test
    void creationWhitelistAppliesToCompanyAndAdminInEveryVerificationState() throws Exception {
        User admin = createUser("creation-admin@example.test", UserRole.ADMIN);
        for (CompanyStatus verification : CompanyStatus.values()) {
            Company company = createCompany("creation-" + verification + "@example.test", "Creation", verification);
            for (User actor : List.of(company.getUser(), admin)) {
                for (JobStatus target : JobStatus.values()) {
                    int expected = target == JobStatus.DRAFT ? 200
                            : target == JobStatus.PENDING_APPROVAL ? (verification == CompanyStatus.VERIFIED ? 200 : 403)
                            : actor.getRole() == UserRole.COMPANY && Set.of(JobStatus.ACTIVE, JobStatus.REJECTED, JobStatus.EXPIRED).contains(target) ? 403 : 400;
                    var response = mockMvc.perform(post("/api/jobs").header("Authorization", bearerToken(actor)).contentType("application/json")
                                    .content(objectMapper.writeValueAsString(Map.of("title", "Creation policy", "description", "Synthetic creation test",
                                            "jobType", "INTERNSHIP", "workingModel", "HYBRID", "companyId", company.getId(), "status", target))))
                            .andExpect(status().is(expected));
                    if (expected == 200) response.andExpect(jsonPath("$.data.companyId").value(company.getId()))
                            .andExpect(jsonPath("$.data.status").value(target.name()));
                }
                mockMvc.perform(post("/api/jobs").header("Authorization", bearerToken(actor)).contentType("application/json")
                                .content(objectMapper.writeValueAsString(Map.of("title", "Default draft", "description", "Synthetic default test",
                                        "jobType", "INTERNSHIP", "workingModel", "HYBRID", "companyId", company.getId()))))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT"));
            }
        }
    }

    @Test
    void everyCompanyVerificationTransitionIsAdminOnly() throws Exception {
        User admin = createUser("verification-admin@example.test", UserRole.ADMIN);
        User student = createStudent("verification-student@example.test").getUser();
        for (CompanyStatus from : CompanyStatus.values()) {
            for (CompanyStatus target : CompanyStatus.values()) {
                Company company = createCompany(from + "-" + target + "@example.test", "Verification matrix", from);
                for (User denied : List.of(company.getUser(), student)) {
                    mockMvc.perform(patch("/api/admin/companies/{id}/status", company.getId()).header("Authorization", bearerToken(denied))
                                    .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("status", target))))
                            .andExpect(status().isForbidden());
                    assertThat(companyRepository.findById(company.getId()).orElseThrow().getStatus()).isEqualTo(from);
                }
                mockMvc.perform(patch("/api/admin/companies/{id}/status", company.getId()).header("Authorization", bearerToken(admin))
                                .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("status", target))))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value(target.name()));
                assertThat(companyRepository.findById(company.getId()).orElseThrow().getStatus()).isEqualTo(target);
            }
        }
    }

    @Test
    void onlyDraftContentCanChangeAndPutCannotSmuggleStatus() throws Exception {
        Company company = createCompany("editing@example.test", "Editing", CompanyStatus.VERIFIED);
        User admin = createUser("editor-admin@example.test", UserRole.ADMIN);
        for (User actor : List.of(company.getUser(), admin)) {
            for (JobStatus state : JobStatus.values()) {
                Job job = createJob(company, "Original title", state);
                mockMvc.perform(put("/api/jobs/{id}", job.getId()).header("Authorization", bearerToken(actor))
                                .contentType("application/json").content("{\"title\":\"Updated title\"}"))
                        .andExpect(status().is(state == JobStatus.DRAFT ? 200 : 400));
                assertThat(jobRepository.findById(job.getId()).orElseThrow().getTitle())
                        .isEqualTo(state == JobStatus.DRAFT ? "Updated title" : "Original title");
            }
        }
        Job draft = createJob(company, "Draft", JobStatus.DRAFT);
        mockMvc.perform(put("/api/jobs/{id}", draft.getId()).header("Authorization", bearerToken(company.getUser()))
                .contentType("application/json").content("{\"status\":\"ACTIVE\"}")).andExpect(status().isBadRequest());
        assertThat(jobRepository.findById(draft.getId()).orElseThrow().getStatus()).isEqualTo(JobStatus.DRAFT);
    }

    @Test
    void adminMustReviewPendingJobAndVerificationHidesWithoutRewritingOldJobs() throws Exception {
        Company company = createCompany("visibility@example.test", "Visibility", CompanyStatus.VERIFIED);
        User admin = createUser("visibility-admin@example.test", UserRole.ADMIN);
        User student = createStudent("visibility-student@example.test").getUser();
        Job active = createJob(company, "Legacy active", JobStatus.ACTIVE);
        Job draft = createJob(company, "Legacy draft", JobStatus.DRAFT);
        var before = active.getUpdatedAt();
        String adminToken = bearerToken(admin);
        mockMvc.perform(patch("/api/jobs/{id}/status", draft.getId()).header("Authorization", adminToken)
                .contentType("application/json").content("{\"status\":\"ACTIVE\"}")).andExpect(status().isBadRequest());
        for (CompanyStatus state : List.of(CompanyStatus.PENDING, CompanyStatus.BLOCKED, CompanyStatus.VERIFIED)) {
            mockMvc.perform(patch("/api/admin/companies/{id}/status", company.getId()).header("Authorization", adminToken)
                    .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("status", state)))).andExpect(status().isOk());
            mockMvc.perform(get("/api/public/jobs/{id}", active.getId())).andExpect(status().is(state == CompanyStatus.VERIFIED ? 200 : 404));
            mockMvc.perform(get("/api/public/jobs")).andExpect(jsonPath("$.data.totalItems").value(state == CompanyStatus.VERIFIED ? 1 : 0));
            mockMvc.perform(get("/api/jobs").header("Authorization", bearerToken(student)))
                    .andExpect(jsonPath("$.data.totalItems").value(state == CompanyStatus.VERIFIED ? 1 : 0));
            if (state != CompanyStatus.VERIFIED) {
                mockMvc.perform(post("/api/jobs/{id}/apply", active.getId()).header("Authorization", bearerToken(student))
                        .contentType("application/json").content("{}")).andExpect(status().isBadRequest());
            }
            Job unchanged = jobRepository.findById(active.getId()).orElseThrow();
            assertThat(unchanged.getStatus()).isEqualTo(JobStatus.ACTIVE);
            assertThat(unchanged.getUpdatedAt()).isEqualTo(before);
        }
    }

    @Test
    void concurrentApproveAndRejectCannotBothDecideTheSamePendingSnapshot() throws Exception {
        Company company = createCompany("race@example.test", "Race", CompanyStatus.VERIFIED);
        User admin = createUser("race-admin@example.test", UserRole.ADMIN);
        Job pending = createJob(company, "Review race", JobStatus.PENDING_APPROVAL);
        String token = bearerToken(admin);
        CyclicBarrier start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> approve = () -> review(start, pending.getId(), token, "ACTIVE");
            Callable<Integer> reject = () -> review(start, pending.getId(), token, "REJECTED");
            var futures = pool.invokeAll(List.of(approve, reject));
            assertThat(List.of(futures.get(0).get(), futures.get(1).get())).containsExactlyInAnyOrder(200, 400);
        }
    }

    @Test
    void companyProfileEditCannotOverwriteConcurrentAdminBlock() throws Exception {
        Company company = createCompany("profile-race@example.test", "Profile race", CompanyStatus.VERIFIED);
        User admin = createUser("profile-race-admin@example.test", UserRole.ADMIN);
        String ownerToken = bearerToken(company.getUser());
        String adminToken = bearerToken(admin);
        try (var pool = Executors.newSingleThreadExecutor()) {
            // Hold the Admin API transaction open until the profile request reaches
            // its conflicting DB lock. This forces the stale-read race, without sleeps.
            var profile = new TransactionTemplate(transactionManager).execute(transaction -> {
                try {
                    mockMvc.perform(patch("/api/admin/companies/{id}/status", company.getId()).header("Authorization", adminToken)
                                    .contentType("application/json").content("{\"status\":\"BLOCKED\"}"))
                            .andExpect(status().isOk());
                } catch (Exception e) { throw new AssertionError(e); }
                int adminConnection = jdbcTemplate.queryForObject("SELECT pg_backend_pid()", Integer.class);
                var edit = pool.submit(() -> mockMvc.perform(put("/api/companies/me").header("Authorization", ownerToken).header("If-Match", com.tttn.jobrecommendation.common.utils.SettingsRevision.etag(0))
                                .contentType("application/json").content("{\"description\":\"Updated profile\"}"))
                        .andReturn().getResponse().getStatus());
                await().pollInterval(Duration.ofMillis(20)).atMost(Duration.ofSeconds(10)).until(() ->
                        jdbcTemplate.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE ? = ANY(pg_blocking_pids(pid))", Integer.class, adminConnection) > 0);
                return edit;
            });
            assertThat(profile.get(10, TimeUnit.SECONDS)).isEqualTo(200);
        }
        Company persisted = companyRepository.findById(company.getId()).orElseThrow();
        assertThat(persisted.getDescription()).isEqualTo("Updated profile");
        assertThat(persisted.getStatus()).isEqualTo(CompanyStatus.BLOCKED);
    }

    private int review(CyclicBarrier start, Long jobId, String token, String status) throws Exception {
        start.await();
        return mockMvc.perform(patch("/api/jobs/{id}/status", jobId).header("Authorization", token)
                .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("status", status))))
                .andReturn().getResponse().getStatus();
    }

    private int expectedTransition(UserRole role, CompanyStatus company, JobStatus from, JobStatus to) {
        if (role == UserRole.COMPANY && Set.of(JobStatus.ACTIVE, JobStatus.REJECTED, JobStatus.EXPIRED).contains(to)) return 403;
        if ((to == JobStatus.ACTIVE || to == JobStatus.PENDING_APPROVAL) && company != CompanyStatus.VERIFIED) return 403;
        String edge = from + ">" + to;
        return COMMON_EDGES.contains(edge) || (role == UserRole.ADMIN && ADMIN_EDGES.contains(edge)) ? 200 : 400;
    }

    private String jobBody(String state) throws Exception {
        return objectMapper.writeValueAsString(Map.of("title", "Moderation intern", "description", "Build maintainable services with a mentor.",
                "jobType", "INTERNSHIP", "workingModel", "HYBRID", "status", state));
    }
}
