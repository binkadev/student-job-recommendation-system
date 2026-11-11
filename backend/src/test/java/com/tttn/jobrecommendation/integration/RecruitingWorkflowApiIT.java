package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RecruitingWorkflowApiIT extends AbstractPostgresWebIntegrationTest {
    @Autowired ObjectMapper mapper;
    @Autowired SavedCandidateRepository savedCandidates;
    Student student, foreign;
    Company company, other;
    Job job, target;
    JobApplication application;
    User admin;
    @BeforeEach void fixtures() {
        student = createStudent("student@workflow.test"); foreign = createStudent("foreign@workflow.test");
        company = createCompany("company@workflow.test", "Owner", CompanyStatus.VERIFIED);
        other = createCompany("other@workflow.test", "Other", CompanyStatus.VERIFIED);
        admin = createUser("admin@workflow.test", UserRole.ADMIN);
        job = createJob(company, "Applied job", JobStatus.ACTIVE);
        target = createJob(company, "Invited job", JobStatus.ACTIVE);
        application = createApplication(student, job, null, ApplicationStatus.PENDING);
    }
    Map<String,Object> interviewBody() {
        return new HashMap<>(Map.of("applicationId", application.getId(), "title", "Technical interview",
                "scheduledAt", LocalDateTime.now().plusDays(1).toString(), "durationMinutes", 60,
                "meetingType", "ONLINE", "locationOrLink", "https://meet.example.test/session", "notes", "Synthetic notes"));
    }
    Map<String,Object> invitationBody() { return Map.of("jobId", target.getId(), "studentId", student.getId(), "message", "Please apply"); }
    MvcResult postAs(String path, User user, Object body) throws Exception {
        return mockMvc.perform(post(path).header("Authorization", bearerToken(user)).contentType("application/json")
                .content(mapper.writeValueAsString(body))).andReturn();
    }
    MvcResult update(String feature, long id, User user, boolean employer, String expected, String next) throws Exception {
        String prefix = employer ? "/api/companies/me/" : "/api/students/me/";
        return mockMvc.perform(patch(prefix + feature + "/" + id + (employer ? "/status" : "/respond"))
                .header("Authorization", bearerToken(user)).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("expectedStatus", expected, "status", next)))).andReturn();
    }
    int code(MvcResult result) { return result.getResponse().getStatus(); }
    JsonNode data(MvcResult result) throws Exception { return mapper.readTree(result.getResponse().getContentAsString()).path("data"); }
    long interview() throws Exception {
        var result = postAs("/api/companies/me/interviews", company.getUser(), interviewBody());
        assertThat(code(result)).isEqualTo(200); return data(result).path("id").asLong();
    }
    long invitation() throws Exception {
        var result = postAs("/api/companies/me/invitations", company.getUser(), invitationBody());
        assertThat(code(result)).isEqualTo(200); return data(result).path("id").asLong();
    }

    @Test void createsInterviewFromApplicationAndIgnoresForgedOwnershipFields() throws Exception {
        var body = interviewBody(); body.put("companyId", other.getId()); body.put("studentId", foreign.getId()); body.put("jobId", target.getId());
        var result = postAs("/api/companies/me/interviews", company.getUser(), body);
        assertThat(code(result)).isEqualTo(200); var item = data(result);
        assertThat(item.path("companyId").asLong()).isEqualTo(company.getId());
        assertThat(item.path("studentId").asLong()).isEqualTo(student.getId());
        assertThat(item.path("jobId").asLong()).isEqualTo(job.getId());
        assertThat(item.path("applicationId").asLong()).isEqualTo(application.getId());
        assertThat(item.path("status").asText()).isEqualTo("SCHEDULED");
        assertThat(item.path("title").asText()).isEqualTo("Technical interview");
        mockMvc.perform(get("/api/students/me/interviews").header("Authorization", bearerToken(student.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(1)).andExpect(jsonPath("$.data.items[0].id").value(item.path("id").asLong()));
        assertThat(jdbcTemplate.queryForObject("select status from applications where id=?", String.class, application.getId())).isEqualTo("PENDING");
        assertThat(jdbcTemplate.queryForObject("select count(*) from notifications", Long.class)).isZero();
    }

    @Test void onlyOwnerCanCreateAndRespondAndListsAreDatabaseScoped() throws Exception {
        assertThat(code(postAs("/api/companies/me/interviews", other.getUser(), interviewBody()))).isEqualTo(403);
        long id = interview();
        assertThat(code(update("interviews", id, foreign.getUser(), false, "SCHEDULED", "CONFIRMED"))).isEqualTo(403);
        assertThat(code(update("interviews", id, other.getUser(), true, "SCHEDULED", "CANCELLED"))).isEqualTo(403);
        for (var entry : Map.of("/api/companies/me/interviews", other.getUser(), "/api/students/me/interviews", foreign.getUser()).entrySet()) {
            mockMvc.perform(get(entry.getKey()).header("Authorization", bearerToken(entry.getValue())))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(0));
        }
        assertThat(code(update("interviews", id, student.getUser(), false, "SCHEDULED", "CONFIRMED"))).isEqualTo(200);
        assertThat(code(update("interviews", id, company.getUser(), true, "SCHEDULED", "CANCELLED"))).isEqualTo(409);
    }

    @Test void interviewLifecycleSupportsConfirmDeclineCancelAndDelayedCompletion() throws Exception {
        long id = interview();
        assertThat(code(update("interviews", id, student.getUser(), false, "SCHEDULED", "CONFIRMED"))).isEqualTo(200);
        assertThat(code(update("interviews", id, company.getUser(), true, "CONFIRMED", "COMPLETED"))).isEqualTo(400);
        jdbcTemplate.update("update interviews set scheduled_at=? where id=?", LocalDateTime.now().minusHours(2), id);
        assertThat(code(update("interviews", id, company.getUser(), true, "CONFIRMED", "COMPLETED"))).isEqualTo(200);
        assertThat(code(update("interviews", id, company.getUser(), true, "COMPLETED", "CANCELLED"))).isEqualTo(400);
        long declined = interview();
        assertThat(code(update("interviews", declined, student.getUser(), false, "SCHEDULED", "DECLINED"))).isEqualTo(200);
        assertThat(code(update("interviews", declined, company.getUser(), true, "DECLINED", "CANCELLED"))).isEqualTo(400);
        long cancelled = interview();
        assertThat(code(update("interviews", cancelled, company.getUser(), true, "SCHEDULED", "CANCELLED"))).isEqualTo(200);
        assertThat(code(update("interviews", cancelled, student.getUser(), false, "CANCELLED", "CONFIRMED"))).isEqualTo(400);
        long confirmed = interview();
        assertThat(code(update("interviews", confirmed, student.getUser(), false, "SCHEDULED", "CONFIRMED"))).isEqualTo(200);
        assertThat(code(update("interviews", confirmed, company.getUser(), true, "CONFIRMED", "CANCELLED"))).isEqualTo(200);
        assertThat(jdbcTemplate.queryForObject("select status from applications where id=?", String.class, application.getId())).isEqualTo("PENDING");
    }

    @Test void rejectsWrongActorNoOpAndResponseAfterStart() throws Exception {
        long id = interview();
        for (String state : List.of("SCHEDULED", "COMPLETED", "CONFIRMED", "DECLINED"))
            assertThat(code(update("interviews", id, company.getUser(), true, "SCHEDULED", state))).isEqualTo(400);
        for (String state : List.of("SCHEDULED", "COMPLETED", "CANCELLED"))
            assertThat(code(update("interviews", id, student.getUser(), false, "SCHEDULED", state))).isEqualTo(400);
        jdbcTemplate.update("update interviews set scheduled_at=? where id=?", LocalDateTime.now().minusMinutes(1), id);
        assertThat(code(update("interviews", id, student.getUser(), false, "SCHEDULED", "CONFIRMED"))).isEqualTo(400);
    }

    @ParameterizedTest @ValueSource(strings={"REJECTED", "WITHDRAWN"})
    void rejectsTerminalApplications(String state) throws Exception {
        application.setStatus(ApplicationStatus.valueOf(state)); jobApplicationRepository.saveAndFlush(application);
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), interviewBody()))).isEqualTo(400);
        assertThat(jdbcTemplate.queryForObject("select count(*) from interviews", Long.class)).isZero();
    }
    @ParameterizedTest @ValueSource(strings={"PENDING", "REVIEWED", "ACCEPTED"})
    void acceptsLiveApplicationStatesWithoutMutatingThem(String state) throws Exception {
        application.setStatus(ApplicationStatus.valueOf(state)); jobApplicationRepository.saveAndFlush(application);
        interview();
        assertThat(jdbcTemplate.queryForObject("select status from applications where id=?", String.class, application.getId())).isEqualTo(state);
    }
    @ParameterizedTest @ValueSource(strings={"javascript:alert(1)", "https:///missing-host", "https://u:p@example.test", "https://example.test/a b", "https://example.test:70000"})
    void rejectsUnsafeOnlineMeetingDetails(String url) throws Exception {
        var body = interviewBody(); body.put("locationOrLink", url);
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).isEqualTo(400);
    }
    @Test void validatesInterviewFieldsAndOnsiteDetails() throws Exception {
        Map<String,Object> invalid = Map.of("applicationId", -1, "title", " ", "scheduledAt", LocalDateTime.now().minusMinutes(1).toString(),
                "durationMinutes", 14, "meetingType", "REMOTE", "locationOrLink", " ", "notes", "x".repeat(5001));
        for (var entry : invalid.entrySet()) {
            var body = interviewBody(); body.put(entry.getKey(), entry.getValue());
            assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).as(entry.getKey()).isEqualTo(400);
        }
        var body = interviewBody(); body.put("title", "x".repeat(256));
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).isEqualTo(400);
        body=interviewBody(); body.put("durationMinutes", 481);
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).isEqualTo(400);
        body=interviewBody(); body.put("locationOrLink", "x".repeat(1001));
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).isEqualTo(400);
        body=interviewBody(); body.remove("scheduledAt");
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).isEqualTo(400);
        body=interviewBody(); body.put("meetingType", "ONSITE"); body.put("locationOrLink", "Room 3, synthetic address");
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), body))).isEqualTo(200);
    }

    @Test void invitesCompanyApplicantToDifferentOwnedJobAndAcceptsWithoutApplication() throws Exception {
        long id = invitation();
        mockMvc.perform(get("/api/students/me/invitations").header("Authorization", bearerToken(student.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].jobId").value(target.getId()));
        assertThat(code(update("invitations", id, student.getUser(), false, "PENDING", "ACCEPTED"))).isEqualTo(200);
        assertThat(jdbcTemplate.queryForObject("select count(*) from applications", Long.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select status from applications where id=?", String.class, application.getId())).isEqualTo("PENDING");
        assertThat(jdbcTemplate.queryForObject("select count(*) from notifications", Long.class)).isZero();
        assertThat(code(update("invitations", id, student.getUser(), false, "ACCEPTED", "DECLINED"))).isEqualTo(400);
    }

    @Test void declineAndCancellationAreTerminalHistoryAndNewPendingIsAllowed() throws Exception {
        long first = invitation();
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), invitationBody()))).isEqualTo(409);
        assertThat(code(update("invitations", first, student.getUser(), false, "PENDING", "DECLINED"))).isEqualTo(200);
        long second = invitation();
        assertThat(code(update("invitations", second, company.getUser(), true, "PENDING", "CANCELLED"))).isEqualTo(200);
        long third = invitation();
        assertThat(third).isGreaterThan(second);
        assertThat(jdbcTemplate.queryForObject("select count(*) from job_invitations", Long.class)).isEqualTo(3);
    }

    @Test void savedCandidateAssociationUsesCompanyStudentNotSourceJob() throws Exception {
        savedCandidates.saveAndFlush(SavedCandidate.builder().company(company).student(student).application(application).build());
        // The relation stays valid when its source application is historical; a target Job is independent.
        application.setStatus(ApplicationStatus.REJECTED); jobApplicationRepository.saveAndFlush(application);
        invitation();
        assertThat(savedCandidates.existsByCompanyIdAndStudentId(other.getId(), student.getId())).isFalse();
        assertThat(code(postAs("/api/companies/me/invitations", other.getUser(), Map.of("jobId", createJob(other,"Other",JobStatus.ACTIVE).getId(),"studentId",student.getId())))).isEqualTo(403);
    }

    @Test void invitationOwnershipCannotBeForgedAndForeignListsAreEmpty() throws Exception {
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), Map.of("jobId",target.getId(),"studentId",foreign.getId())))).isEqualTo(403);
        assertThat(code(postAs("/api/companies/me/invitations", other.getUser(), invitationBody()))).isEqualTo(403);
        var forged = new HashMap<String,Object>(invitationBody()); forged.put("companyId", other.getId());
        var result = postAs("/api/companies/me/invitations", company.getUser(), forged);
        assertThat(code(result)).isEqualTo(200); long id = data(result).path("id").asLong();
        assertThat(data(result).path("companyId").asLong()).isEqualTo(company.getId());
        assertThat(code(update("invitations", id, foreign.getUser(), false, "PENDING", "ACCEPTED"))).isEqualTo(403);
        assertThat(code(update("invitations", id, other.getUser(), true, "PENDING", "CANCELLED"))).isEqualTo(403);
        mockMvc.perform(get("/api/companies/me/invitations").header("Authorization", bearerToken(other.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(0));
        mockMvc.perform(get("/api/students/me/invitations").header("Authorization", bearerToken(foreign.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalItems").value(0));
        assertThat(code(update("invitations", id, company.getUser(), true, "PENDING", "ACCEPTED"))).isEqualTo(400);
        assertThat(code(update("invitations", id, student.getUser(), false, "PENDING", "CANCELLED"))).isEqualTo(400);
    }

    @ParameterizedTest @ValueSource(strings={"DRAFT", "PENDING_APPROVAL", "REJECTED", "CLOSED", "EXPIRED"})
    void onlyActiveJobsReceiveInvitations(String state) throws Exception {
        target.setStatus(JobStatus.valueOf(state)); jobRepository.saveAndFlush(target);
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), invitationBody()))).isEqualTo(400);
    }
    @ParameterizedTest @ValueSource(strings={"PENDING", "BLOCKED"})
    void onlyVerifiedCompaniesCanCreateRecruitingRecords(String state) throws Exception {
        company.setStatus(CompanyStatus.valueOf(state)); companyRepository.saveAndFlush(company);
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), invitationBody()))).isEqualTo(400);
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), interviewBody()))).isEqualTo(400);
    }
    @Test void expiryInactiveStudentMissingReferencesAndMessageLimits() throws Exception {
        target.setDeadline(LocalDate.now().minusDays(1)); jobRepository.saveAndFlush(target);
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), invitationBody()))).isEqualTo(400);
        target.setDeadline(null); jobRepository.saveAndFlush(target);
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), Map.of("jobId",target.getId(),"studentId",student.getId(),"message","x".repeat(5001))))).isEqualTo(400);
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), Map.of("jobId",-1,"studentId",student.getId())))).isEqualTo(400);
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), Map.of("jobId",target.getId(),"studentId",999999)))).isEqualTo(404);
        var invalid = interviewBody(); invalid.put("applicationId", 999999);
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), invalid))).isEqualTo(404);
        student.getUser().setStatus(UserStatus.BLOCKED); userRepository.saveAndFlush(student.getUser());
        assertThat(code(postAs("/api/companies/me/invitations", company.getUser(), invitationBody()))).isEqualTo(400);
        assertThat(code(postAs("/api/companies/me/interviews", company.getUser(), interviewBody()))).isEqualTo(400);
    }

    @Test void listPaginationBoundsOrderingAndRbacAreEnforced() throws Exception {
        long first=interview(), second=interview();
        for (String feature : List.of("interviews", "invitations")) {
            String companyPath="/api/companies/me/"+feature, studentPath="/api/students/me/"+feature;
            mockMvc.perform(get(companyPath)).andExpect(status().isUnauthorized());
            for (User wrong : List.of(student.getUser(), admin))
                mockMvc.perform(get(companyPath).header("Authorization",bearerToken(wrong))).andExpect(status().isForbidden());
            for (User wrong : List.of(company.getUser(), admin))
                mockMvc.perform(get(studentPath).header("Authorization",bearerToken(wrong))).andExpect(status().isForbidden());
            for(String query : List.of("?page=0", "?size=0", "?size=101"))
                mockMvc.perform(get(companyPath+query).header("Authorization",bearerToken(company.getUser()))).andExpect(status().isBadRequest());
        }
        mockMvc.perform(get("/api/companies/me/interviews?page=1&size=1").header("Authorization",bearerToken(company.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].id").value(second)).andExpect(jsonPath("$.data.totalItems").value(2)).andExpect(jsonPath("$.data.totalPages").value(2));
        mockMvc.perform(get("/api/companies/me/interviews?page=2&size=1").header("Authorization",bearerToken(company.getUser())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].id").value(first));
        assertThat(code(postAs("/api/companies/me/interviews",student.getUser(),interviewBody()))).isEqualTo(403);
        assertThat(code(postAs("/api/companies/me/invitations",admin,invitationBody()))).isEqualTo(403);
        mockMvc.perform(patch("/api/students/me/interviews/1/respond").header("Authorization",bearerToken(student.getUser())).contentType("application/json").content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isBadRequest());
    }


    @Test void exhaustiveInterviewActorTransitionMatrix() throws Exception {
        long id=interview();
        for(boolean employer:new boolean[]{false,true}) for(var current:InterviewStatus.values()) for(var next:InterviewStatus.values()) {
            LocalDateTime time=current==InterviewStatus.CONFIRMED?LocalDateTime.now().minusHours(2):LocalDateTime.now().plusDays(1);
            jdbcTemplate.update("update interviews set status=?,scheduled_at=? where id=?",current.name(),time,id);
            boolean allowed=employer
                    ? ((current==InterviewStatus.SCHEDULED || current==InterviewStatus.CONFIRMED) && next==InterviewStatus.CANCELLED)
                      || current==InterviewStatus.CONFIRMED && next==InterviewStatus.COMPLETED
                    : current==InterviewStatus.SCHEDULED && (next==InterviewStatus.CONFIRMED || next==InterviewStatus.DECLINED);
            int result=code(update("interviews",id,employer?company.getUser():student.getUser(),employer,current.name(),next.name()));
            assertThat(result).as("employer=%s %s -> %s",employer,current,next).isEqualTo(allowed?200:400);
            assertThat(jdbcTemplate.queryForObject("select status from interviews where id=?",String.class,id)).isEqualTo((allowed?next:current).name());
        }
    }
    @Test void exhaustiveInvitationActorTransitionMatrix() throws Exception {
        long id=invitation();
        for(boolean employer:new boolean[]{false,true}) for(var current:InvitationStatus.values()) for(var next:InvitationStatus.values()) {
            jdbcTemplate.update("update job_invitations set status=? where id=?",current.name(),id);
            boolean allowed=current==InvitationStatus.PENDING && (employer?next==InvitationStatus.CANCELLED:next==InvitationStatus.ACCEPTED || next==InvitationStatus.DECLINED);
            int result=code(update("invitations",id,employer?company.getUser():student.getUser(),employer,current.name(),next.name()));
            assertThat(result).as("employer=%s %s -> %s",employer,current,next).isEqualTo(allowed?200:400);
            assertThat(jdbcTemplate.queryForObject("select status from job_invitations where id=?",String.class,id)).isEqualTo((allowed?next:current).name());
        }
    }

    @Test void concurrentInterviewResponsesUseCapturedStateUnderLock() throws Exception {
        raceState("interviews",interview(),"SCHEDULED","CONFIRMED","CANCELLED");
    }
    @Test void concurrentInvitationAcceptanceAndCancellationHasOneWinner() throws Exception {
        raceState("invitations",invitation(),"PENDING","ACCEPTED","CANCELLED");
    }
    private void raceState(String feature,long id,String initial,String studentTarget,String companyTarget) throws Exception {
        String table=feature.equals("interviews")?"interviews":"job_invitations";
        try(var pool=Executors.newFixedThreadPool(2);var blocker=jdbcTemplate.getDataSource().getConnection()) {
            blocker.setAutoCommit(false);
            try(var sql=blocker.prepareStatement("select id from "+table+" where id=? for update")) {
                sql.setLong(1,id);try(var rows=sql.executeQuery()){assertThat(rows.next()).isTrue();}
            }
            var a=pool.submit(()->update(feature,id,student.getUser(),false,initial,studentTarget));
            var b=pool.submit(()->update(feature,id,company.getUser(),true,initial,companyTarget));
            try {
                await().pollInSameThread().atMost(Duration.ofSeconds(15)).until(()->{
                    try(var probe=blocker.createStatement()) {
                        probe.execute("select pg_stat_clear_snapshot()");
                        try(var rows=probe.executeQuery("select count(*) from pg_stat_activity where wait_event_type='Lock' and query ilike '%"+table+"%'")) {
                            rows.next();return rows.getLong(1)>=2;
                        }
                    }
                });
            } finally {blocker.rollback();}
            int studentCode=code(a.get(20,TimeUnit.SECONDS)), companyCode=code(b.get(20,TimeUnit.SECONDS));
            assertThat(List.of(studentCode,companyCode)).containsExactlyInAnyOrder(200,409);
            assertThat(jdbcTemplate.queryForObject("select status from "+table+" where id=?",String.class,id)).isEqualTo(studentCode==200?studentTarget:companyTarget);
        }
    }
    @Test void concurrentInvitationCreationHasOnePendingRow() throws Exception {
        var barrier=new CyclicBarrier(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(()->{barrier.await();return postAs("/api/companies/me/invitations",company.getUser(),invitationBody());});
            var b=pool.submit(()->{barrier.await();return postAs("/api/companies/me/invitations",company.getUser(),invitationBody());});
            assertThat(List.of(code(a.get(20,TimeUnit.SECONDS)),code(b.get(20,TimeUnit.SECONDS)))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(jdbcTemplate.queryForObject("select count(*) from job_invitations where status='PENDING'",Long.class)).isEqualTo(1);
    }
}
