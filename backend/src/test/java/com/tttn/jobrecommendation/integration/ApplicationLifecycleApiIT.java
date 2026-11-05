package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApplicationLifecycleApiIT extends AbstractPostgresWebIntegrationTest {
    @Autowired ObjectMapper mapper;
    private Student student, foreign;
    private Company company, other;
    private Job job;
    @BeforeEach void fixtures() {
        student = createStudent("lifecycle@example.test"); foreign = createStudent("foreign@example.test");
        company = createCompany("owner@example.test", "Lifecycle", CompanyStatus.VERIFIED);
        other = createCompany("other@example.test", "Other", CompanyStatus.VERIFIED);
        job = createJob(company, "Lifecycle role", JobStatus.ACTIVE);
    }
    private MvcResult transition(long id, User user, ApplicationStatus target) throws Exception {
        return mockMvc.perform(patch("/api/applications/{id}/status", id).header("Authorization", bearerToken(user))
                .contentType("application/json").content("{\"status\":\"" + target + "\"}")).andReturn();
    }
    private MvcResult apply(User user, Job target, String letter) throws Exception {
        return mockMvc.perform(post("/api/jobs/{id}/apply", target.getId()).header("Authorization", bearerToken(user))
                .contentType("application/json").content(mapper.writeValueAsString(java.util.Map.of("coverLetter", letter)))).andReturn();
    }
    private int code(MvcResult result) { return result.getResponse().getStatus(); }
    private long notifications(long id) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM notifications WHERE reference_type='APPLICATION' AND reference_id=?", Long.class, id);
    }

    @Test void pendingWithdrawalPersistsAndDuplicateIsRejectedWithoutNotification() throws Exception {
        var app = createApplication(student, job, null, ApplicationStatus.PENDING);
        assertThat(code(transition(app.getId(), student.getUser(), ApplicationStatus.WITHDRAWN))).isEqualTo(200);
        mockMvc.perform(get("/api/students/me/applications/{id}", app.getId()).header("Authorization", bearerToken(student.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("WITHDRAWN"));
        mockMvc.perform(get("/api/companies/me/applications/{id}", app.getId()).header("Authorization", bearerToken(company.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("WITHDRAWN"));
        assertThat(code(transition(app.getId(), student.getUser(), ApplicationStatus.WITHDRAWN))).isEqualTo(400);
        assertThat(notifications(app.getId())).isZero();
        assertThat(code(apply(student.getUser(), job, "blocked"))).isEqualTo(400);
        assertThat(jobApplicationRepository.count()).isEqualTo(1);
    }

    @Test void everyRoleAndStateEdgeKeepsExistingStateMachineAndNotificationRules() throws Exception {
        var admin = createUser("admin@example.test", UserRole.ADMIN);
        // An independent job per row avoids imposing invalid active-pair fixtures.
        for (var actor : List.of(student.getUser(), company.getUser(), admin)) {
            for (var before : ApplicationStatus.values()) for (var target : ApplicationStatus.values()) {
                Job separate = createJob(company, "Matrix " + actor.getRole() + before + target, JobStatus.ACTIVE);
                var app = createApplication(student, separate, null, before);
                boolean studentActor = actor.getRole() == UserRole.STUDENT;
                boolean allowed = studentActor ? before == ApplicationStatus.PENDING && target == ApplicationStatus.WITHDRAWN
                        : before == ApplicationStatus.PENDING && target == ApplicationStatus.REVIEWED
                        || (before == ApplicationStatus.PENDING || before == ApplicationStatus.REVIEWED)
                        && (target == ApplicationStatus.ACCEPTED || target == ApplicationStatus.REJECTED);
                int expected = allowed ? 200 : studentActor && (target == ApplicationStatus.ACCEPTED || target == ApplicationStatus.REJECTED) ? 403 : 400;
                assertThat(code(transition(app.getId(), actor, target))).as("%s: %s -> %s", actor.getRole(), before, target).isEqualTo(expected);
                var persisted = jobApplicationRepository.findById(app.getId()).orElseThrow();
                assertThat(persisted.getStatus()).isEqualTo(allowed ? target : before);
                assertThat(notifications(app.getId())).isEqualTo(allowed && !studentActor ? 1 : 0);
            }
        }
    }

    @Test void foreignStudentAndCompanyCannotMutateAndCompanyCannotApply() throws Exception {
        var app = createApplication(student, job, null, ApplicationStatus.PENDING);
        assertThat(code(transition(app.getId(), foreign.getUser(), ApplicationStatus.WITHDRAWN))).isEqualTo(403);
        assertThat(code(transition(app.getId(), other.getUser(), ApplicationStatus.REJECTED))).isEqualTo(403);
        assertThat(code(apply(company.getUser(), job, "company cannot apply"))).isEqualTo(403);
        assertThat(jobApplicationRepository.findById(app.getId()).orElseThrow().getStatus()).isEqualTo(ApplicationStatus.PENDING);
        assertThat(notifications(app.getId())).isZero();
    }

    @Test void concurrentWithdrawalAndReviewSerializeBeforeCheckingTheState() throws Exception {
        // Hold a DB row lock until both real HTTP transactions are waiting on it.
        // Without a read lock in updateStatus both callers validate PENDING then both return200.
        try (var pool = Executors.newFixedThreadPool(2)) {
            for (int round = 0; round < 5; round++) {
                var app = createApplication(student, createJob(company, "Race " + round, JobStatus.ACTIVE), null, ApplicationStatus.PENDING);
                try (var blocker = jdbcTemplate.getDataSource().getConnection()) {
                    blocker.setAutoCommit(false);
                    try (var sql = blocker.prepareStatement("SELECT id FROM applications WHERE id=? FOR UPDATE")) {
                        sql.setLong(1, app.getId()); try (var rows = sql.executeQuery()) { assertThat(rows.next()).isTrue(); }
                    }
                    var withdraw = pool.submit(() -> transition(app.getId(), student.getUser(), ApplicationStatus.WITHDRAWN));
                    var review = pool.submit(() -> transition(app.getId(), company.getUser(), ApplicationStatus.REVIEWED));
                    try {
                        // Reuse the blocker connection: integration pool has three slots,
                        // already occupied by blocker and the two concurrent requests.
                        await().pollInSameThread().atMost(Duration.ofSeconds(15)).until(() -> {
                            try (var probe = blocker.createStatement()) {
                                probe.execute("SELECT pg_stat_clear_snapshot()");
                                try (var waiting = probe.executeQuery("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query ILIKE '%applications%'")) {
                                    waiting.next(); return waiting.getLong(1) >= 2;
                                }
                            }
                        });
                    } finally { blocker.rollback(); }
                    int studentCode = code(withdraw.get(20, TimeUnit.SECONDS)), companyCode = code(review.get(20, TimeUnit.SECONDS));
                    assertThat(List.of(studentCode, companyCode)).containsExactlyInAnyOrder(200, 400);
                    assertThat(jobApplicationRepository.findById(app.getId()).orElseThrow().getStatus())
                            .isEqualTo(studentCode == 200 ? ApplicationStatus.WITHDRAWN : ApplicationStatus.REVIEWED);
                    assertThat(notifications(app.getId())).isEqualTo(companyCode == 200 ? 1 : 0);
                }
            }
        }
    }

    @Test void concurrentReapplyHasOneNewHistoryRowAndOne409ThenLatestIdTieBreakIsAuthoritative() throws Exception {
        var rejected = createApplication(student, job, null, ApplicationStatus.REJECTED);
        rejected.setCoverLetter("original rejected letter"); jobApplicationRepository.saveAndFlush(rejected);
        var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> { barrier.await(); return apply(student.getUser(), job, "new A"); });
            var b = pool.submit(() -> { barrier.await(); return apply(student.getUser(), job, "new B"); });
            assertThat(List.of(code(a.get(20, TimeUnit.SECONDS)), code(b.get(20, TimeUnit.SECONDS)))).containsExactlyInAnyOrder(200, 409);
        }
        var history = jobApplicationRepository.findByStudentIdAndJobIdOrderByAppliedAtDescIdDesc(student.getId(), job.getId());
        assertThat(history).hasSize(2); assertThat(history.getFirst().getStatus()).isEqualTo(ApplicationStatus.PENDING);
        assertThat(jobApplicationRepository.findById(rejected.getId()).orElseThrow().getCoverLetter()).isEqualTo("original rejected letter");
        assertThat(notifications(history.getFirst().getId())).isZero(); // Apply has no status-change notification contract.

        var tieJob = createJob(company, "Ordering", JobStatus.ACTIVE);
        var old = createApplication(student, tieJob, null, ApplicationStatus.REJECTED);
        var latest = createApplication(student, tieJob, null, ApplicationStatus.WITHDRAWN);
        jdbcTemplate.update("UPDATE applications SET applied_at=TIMESTAMP '2026-11-01 08:00:00' WHERE job_id=?", tieJob.getId());
        var ordered = jobApplicationRepository.findByStudentIdAndJobIdOrderByAppliedAtDescIdDesc(student.getId(), tieJob.getId());
        assertThat(ordered.stream().map(JobApplication::getId)).containsExactly(latest.getId(), old.getId());
        assertThat(code(apply(student.getUser(), tieJob, "blocked by latest withdrawn"))).isEqualTo(400);
        // Changing timestamps in this isolated database proves applied_at precedes ID.
        jdbcTemplate.update("UPDATE applications SET applied_at=TIMESTAMP '2026-11-02 08:00:00' WHERE id=?", old.getId());
        assertThat(code(apply(student.getUser(), tieJob, "latest rejected"))).isEqualTo(200);
    }

    @Test void rejectedHistoryDoesNotBypassEligibilityOrCvOwnership() throws Exception {
        createApplication(student, job, null, ApplicationStatus.REJECTED);
        job.setStatus(JobStatus.CLOSED); jobRepository.saveAndFlush(job);
        assertThat(code(apply(student.getUser(), job, "closed"))).isEqualTo(400);
        job.setStatus(JobStatus.ACTIVE); job.setDeadline(LocalDate.now().minusDays(1)); jobRepository.saveAndFlush(job);
        assertThat(code(apply(student.getUser(), job, "expired"))).isEqualTo(400);
        job.setDeadline(null); jobRepository.saveAndFlush(job); company.setStatus(CompanyStatus.BLOCKED); companyRepository.saveAndFlush(company);
        assertThat(code(apply(student.getUser(), job, "blocked"))).isEqualTo(400);
        company.setStatus(CompanyStatus.VERIFIED); companyRepository.saveAndFlush(company);
        var cv = createCv(foreign, "foreign.pdf", true);
        mockMvc.perform(post("/api/jobs/{id}/apply", job.getId()).header("Authorization", bearerToken(student.getUser()))
                .contentType("application/json").content("{\"cvFileId\":" + cv.getId() + "}"))
                .andExpect(status().isForbidden());
        assertThat(jobApplicationRepository.count()).isEqualTo(1);
    }
}
