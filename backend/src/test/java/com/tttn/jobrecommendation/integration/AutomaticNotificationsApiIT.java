package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationGenerationService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** W1-C: automatic notifications for application, moderation and recommendation events (real PostgreSQL). */
class AutomaticNotificationsApiIT extends AbstractPostgresWebIntegrationTest {

    @Autowired private ObjectMapper mapper;
    @Autowired private RecommendationGenerationService generationService;
    @Autowired private RecommendationRunRepository runRepository;
    @MockitoBean private AiServiceClient aiServiceClient;
    @MockitoSpyBean private RecommendationResultRepository resultRepository;

    private Student student;
    private Student otherStudent;
    private Company company;
    private Company otherCompany;
    private User admin;
    private Job activeJob;

    @BeforeEach
    void fixtures() {
        reset(resultRepository);
        student = createStudent("w1c-student@example.test");
        otherStudent = createStudent("w1c-other-student@example.test");
        company = createCompany("w1c-company@example.test", "W1C Company", CompanyStatus.VERIFIED);
        otherCompany = createCompany("w1c-other-company@example.test", "W1C Other", CompanyStatus.VERIFIED);
        admin = createUser("w1c-admin@example.test", UserRole.ADMIN);
        activeJob = createJob(company, "W1C Backend Role", JobStatus.ACTIVE);
    }

    // ---------- application submitted / withdrawn -> owning Company ----------

    @Test
    void applyNotifiesOnlyTheOwningCompanyWithSafeApplicationReference() throws Exception {
        long applicationId = applyOk(student);

        JsonNode inbox = inbox(company.getUser());
        assertThat(inbox.get("totalItems").asInt()).isEqualTo(1);
        JsonNode item = inbox.get("items").get(0);
        assertThat(item.get("type").asText()).isEqualTo("APPLICATION_STATUS_CHANGED");
        assertThat(item.get("title").asText()).isEqualTo("New application received");
        assertThat(item.get("message").asText()).contains("Integration Test User").contains("W1C Backend Role");
        assertThat(item.get("referenceType").asText()).isEqualTo("APPLICATION");
        assertThat(item.get("referenceId").asLong()).isEqualTo(applicationId);
        assertThat(item.get("isRead").asBoolean()).isFalse();
        assertThat(count(student.getUser())).isZero();
        assertThat(count(otherCompany.getUser())).isZero();
        assertThat(count(otherStudent.getUser())).isZero();
        // The referenced application is readable by the recipient (so the inbox link is not dead/foreign).
        mockMvc.perform(get("/api/companies/me/applications/{id}", applicationId)
                .header("Authorization", bearerToken(company.getUser()))).andExpect(status().isOk());
        mockMvc.perform(get("/api/companies/me/applications/{id}", applicationId)
                .header("Authorization", bearerToken(otherCompany.getUser()))).andExpect(status().isForbidden());
    }

    @Test
    void duplicateAndInvalidApplyRequestsCreateNoExtraNotification() throws Exception {
        applyOk(student);
        assertThat(apply(student, activeJob)).isEqualTo(409);        // active application already exists
        assertThat(apply(student, createJob(company, "Draft role", JobStatus.DRAFT))).isEqualTo(400);
        Company pending = createCompany("w1c-pending@example.test", "Pending Co", CompanyStatus.PENDING);
        assertThat(apply(student, createJob(pending, "Unverified role", JobStatus.ACTIVE))).isEqualTo(400);
        assertThat(apply(company.getUser(), activeJob)).isEqualTo(403); // wrong role
        assertThat(count(company.getUser())).isEqualTo(1);
        assertThat(count(pending.getUser())).isZero();
        assertThat(jobApplicationRepository.count()).isEqualTo(1);
    }

    @Test
    void withdrawNotifiesCompanyOnceAndRejectsDuplicateOrForeignWithdrawal() throws Exception {
        long applicationId = applyOk(student);

        assertThat(transition(applicationId, otherStudent.getUser(), "WITHDRAWN")).isEqualTo(403);
        assertThat(transition(applicationId, otherCompany.getUser(), "WITHDRAWN")).isNotEqualTo(200);
        assertThat(count(company.getUser())).isEqualTo(1);

        assertThat(transition(applicationId, student.getUser(), "WITHDRAWN")).isEqualTo(200);
        assertThat(transition(applicationId, student.getUser(), "WITHDRAWN")).isEqualTo(400); // duplicate request
        assertThat(count(company.getUser())).isEqualTo(2);

        JsonNode newest = inbox(company.getUser()).get("items").get(0);
        assertThat(newest.get("title").asText()).isEqualTo("Application withdrawn");
        assertThat(newest.get("referenceType").asText()).isEqualTo("APPLICATION");
        assertThat(newest.get("referenceId").asLong()).isEqualTo(applicationId);
        assertThat(count(student.getUser())).isZero();
    }

    @Test
    void companyDecisionStillNotifiesTheStudentAndNotTheCompany() throws Exception {
        long applicationId = applyOk(student);
        assertThat(transition(applicationId, company.getUser(), "REVIEWED")).isEqualTo(200);
        assertThat(count(student.getUser())).isEqualTo(1);
        assertThat(count(company.getUser())).isEqualTo(1); // only the original "new application" notice
    }

    @Test
    void disabledApplicationPreferenceSuppressesCompanyNoticesWithoutBlockingTheOperation() throws Exception {
        setPreferences(company.getUser(), false, true, true, true);
        long applicationId = applyOk(student);
        assertThat(transition(applicationId, student.getUser(), "WITHDRAWN")).isEqualTo(200);
        assertThat(count(company.getUser())).isZero();
        assertThat(jobApplicationRepository.findById(applicationId).orElseThrow().getStatus())
                .isEqualTo(ApplicationStatus.WITHDRAWN);
        // Other preference flags do not suppress this type, and the preference is per user.
        setPreferences(company.getUser(), true, false, false, false);
        long second = applyOk(otherStudent);
        assertThat(second).isNotEqualTo(applicationId);
        assertThat(count(company.getUser())).isEqualTo(1);
    }

    // ---------- Job moderation -> owning Company ----------

    @Test
    void adminApprovalAndRejectionNotifyTheOwnerOnceWithJobReference() throws Exception {
        Job pending = createJob(company, "Needs review", JobStatus.PENDING_APPROVAL);
        assertThat(jobStatus(pending, company.getUser(), "ACTIVE")).isEqualTo(403);         // company cannot self-approve
        assertThat(jobStatus(pending, otherCompany.getUser(), "ACTIVE")).isEqualTo(403);
        assertThat(jobStatus(pending, student.getUser(), "ACTIVE")).isEqualTo(403);
        assertThat(count(company.getUser())).isZero();

        assertThat(jobStatus(pending, admin, "ACTIVE")).isEqualTo(200);
        assertThat(jobStatus(pending, admin, "ACTIVE")).isEqualTo(200);                      // idempotent no-op
        assertThat(count(company.getUser())).isEqualTo(1);
        JsonNode approved = inbox(company.getUser()).get("items").get(0);
        assertThat(approved.get("type").asText()).isEqualTo("JOB_STATUS_CHANGED");
        assertThat(approved.get("title").asText()).isEqualTo("Job approved");
        assertThat(approved.get("referenceType").asText()).isEqualTo("JOB");
        assertThat(approved.get("referenceId").asLong()).isEqualTo(pending.getId());

        Job second = createJob(company, "Second review", JobStatus.PENDING_APPROVAL);
        assertThat(jobStatus(second, admin, "REJECTED")).isEqualTo(200);
        assertThat(jobStatus(second, admin, "ACTIVE")).isEqualTo(400);                       // invalid edge, no notice
        assertThat(count(company.getUser())).isEqualTo(2);
        assertThat(inbox(company.getUser()).get("items").get(0).get("title").asText()).isEqualTo("Job rejected");
        assertThat(count(otherCompany.getUser())).isZero();
    }

    @Test
    void nonModerationJobTransitionsAndInvalidAdminEdgesDoNotNotify() throws Exception {
        Job draft = createJob(company, "Draft", JobStatus.DRAFT);
        assertThat(jobStatus(draft, company.getUser(), "PENDING_APPROVAL")).isEqualTo(200);  // owner submits
        assertThat(jobStatus(draft, company.getUser(), "CLOSED")).isEqualTo(200);
        Job other = createJob(company, "Never submitted", JobStatus.DRAFT);
        assertThat(jobStatus(other, admin, "ACTIVE")).isEqualTo(400);                        // DRAFT -> ACTIVE invalid
        assertThat(jobStatus(activeJob, admin, "EXPIRED")).isEqualTo(200);                   // not an approve/reject
        assertThat(count(company.getUser())).isZero();
    }

    @Test
    void disabledJobStatusPreferenceSuppressesModerationNotice() throws Exception {
        setPreferences(company.getUser(), true, false, true, true);
        Job pending = createJob(company, "Muted review", JobStatus.PENDING_APPROVAL);
        assertThat(jobStatus(pending, admin, "ACTIVE")).isEqualTo(200);
        assertThat(count(company.getUser())).isZero();
        assertThat(jobRepository.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(JobStatus.ACTIVE);
    }

    // ---------- Company verification -> Company user ----------

    @Test
    void adminVerifyAndBlockNotifyTheCompanyOnlyOnRealStatusChanges() throws Exception {
        Company pending = createCompany("w1c-verify@example.test", "To Verify", CompanyStatus.PENDING);
        assertThat(companyStatus(pending, pending.getUser(), "VERIFIED")).isEqualTo(403);    // self verification
        assertThat(companyStatus(pending, student.getUser(), "VERIFIED")).isEqualTo(403);
        assertThat(count(pending.getUser())).isZero();

        assertThat(companyStatus(pending, admin, "VERIFIED")).isEqualTo(200);
        assertThat(companyStatus(pending, admin, "VERIFIED")).isEqualTo(200);                // no-op
        assertThat(count(pending.getUser())).isEqualTo(1);
        JsonNode verified = inbox(pending.getUser()).get("items").get(0);
        assertThat(verified.get("type").asText()).isEqualTo("SYSTEM");
        assertThat(verified.get("title").asText()).isEqualTo("Company verified");
        assertThat(verified.get("referenceType").isNull()).isTrue();
        assertThat(verified.get("referenceId").isNull()).isTrue();

        assertThat(companyStatus(pending, admin, "BLOCKED")).isEqualTo(200);
        assertThat(count(pending.getUser())).isEqualTo(2);
        assertThat(inbox(pending.getUser()).get("items").get(0).get("title").asText()).isEqualTo("Company blocked");

        assertThat(companyStatus(pending, admin, "PENDING")).isEqualTo(200);                 // not a verify/block event
        assertThat(count(pending.getUser())).isEqualTo(2);
        assertThat(count(company.getUser())).isZero();
    }

    @Test
    void disabledSystemPreferenceSuppressesCompanyVerificationNotice() throws Exception {
        Company pending = createCompany("w1c-muted@example.test", "Muted Co", CompanyStatus.PENDING);
        setPreferences(pending.getUser(), true, true, true, false);
        assertThat(companyStatus(pending, admin, "VERIFIED")).isEqualTo(200);
        assertThat(count(pending.getUser())).isZero();
        assertThat(companyRepository.findById(pending.getId()).orElseThrow().getStatus()).isEqualTo(CompanyStatus.VERIFIED);
    }

    // ---------- Recommendation V3 -> Student ----------

    @Test
    void successfulV3GenerationNotifiesOnlyTheStudentWithRunReference() {
        CvFile cv = readyCv(student);
        stubAiSuccess();
        var run = generationService.generate(student.getUser().getId(), request(cv));

        assertThat(count(student.getUser())).isEqualTo(1);
        var notice = notificationRows(student.getUser()).getFirst();
        assertThat(notice.get("type")).isEqualTo("RECOMMENDATION");
        assertThat(notice.get("title")).isEqualTo("Job recommendations are ready");
        assertThat(notice.get("reference_type")).isEqualTo("RECOMMENDATION_RUN");
        assertThat(((Number) notice.get("reference_id")).longValue()).isEqualTo(run.getId());
        assertThat((String) notice.get("message")).contains("1 matching job");
        assertThat(runRepository.findById(run.getId()).orElseThrow().getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(count(otherStudent.getUser())).isZero();
        assertThat(count(company.getUser())).isZero();
    }

    @Test
    void failedAiCallOrRolledBackPersistenceNeverCreatesASuccessNotification() {
        CvFile cv = readyCv(student);
        when(aiServiceClient.recommendV3(any(AiRecommendationV3Request.class))).thenThrow(new IllegalStateException("AI down"));
        assertThatThrownBy(() -> generationService.generate(student.getUser().getId(), request(cv)))
                .isInstanceOf(RuntimeException.class);
        assertThat(count(student.getUser())).isZero();
        assertThat(runRepository.findAll().getFirst().getStatus()).isEqualTo(RecommendationRunStatus.FAILED);

        stubAiSuccess();
        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new DataIntegrityViolationException("forced flush failure");
        }).when(resultRepository).saveAllAndFlush(anyList());
        assertThatThrownBy(() -> generationService.generate(student.getUser().getId(), request(cv)))
                .isInstanceOf(RuntimeException.class);
        assertThat(count(student.getUser())).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM recommendation_results", Long.class)).isZero();
        assertThat(runRepository.findAll()).allMatch(r -> r.getStatus() == RecommendationRunStatus.FAILED);
    }

    @Test
    void invalidGenerationRequestsAndDisabledPreferenceCreateNoNotification() {
        CvFile notReady = createCv(student, "not-ready.pdf", false);
        GenerateRecommendationRequest bad = request(notReady);
        assertThatThrownBy(() -> generationService.generate(student.getUser().getId(), bad)).isInstanceOf(RuntimeException.class);
        CvFile foreign = readyCv(otherStudent);
        assertThatThrownBy(() -> generationService.generate(student.getUser().getId(), request(foreign)))
                .isInstanceOf(RuntimeException.class);
        assertThat(count(student.getUser())).isZero();
        assertThat(count(otherStudent.getUser())).isZero();

        setPreferences(student.getUser(), true, true, false, true);
        CvFile cv = readyCv(student);
        stubAiSuccess();
        var run = generationService.generate(student.getUser().getId(), request(cv));
        assertThat(count(student.getUser())).isZero();
        assertThat(runRepository.findById(run.getId()).orElseThrow().getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
    }

    // ---------- helpers ----------

    private long applyOk(Student actor) throws Exception {
        var result = mockMvc.perform(post("/api/jobs/{id}/apply", activeJob.getId())
                .header("Authorization", bearerToken(actor.getUser())).contentType("application/json")
                .content("{\"coverLetter\":\"hello\"}")).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return mapper.readTree(result.getResponse().getContentAsString()).get("data").get("id").asLong();
    }

    private int apply(Student actor, Job target) throws Exception {
        return apply(actor.getUser(), target);
    }

    private int apply(User actor, Job target) throws Exception {
        return mockMvc.perform(post("/api/jobs/{id}/apply", target.getId())
                .header("Authorization", bearerToken(actor)).contentType("application/json")
                .content("{\"coverLetter\":\"hello\"}")).andReturn().getResponse().getStatus();
    }

    private int transition(long applicationId, User actor, String target) throws Exception {
        return mockMvc.perform(patch("/api/applications/{id}/status", applicationId)
                .header("Authorization", bearerToken(actor)).contentType("application/json")
                .content("{\"status\":\"" + target + "\"}")).andReturn().getResponse().getStatus();
    }

    private int jobStatus(Job job, User actor, String target) throws Exception {
        return mockMvc.perform(patch("/api/jobs/{id}/status", job.getId())
                .header("Authorization", bearerToken(actor)).contentType("application/json")
                .content("{\"status\":\"" + target + "\"}")).andReturn().getResponse().getStatus();
    }

    private int companyStatus(Company target, User actor, String status) throws Exception {
        return mockMvc.perform(patch("/api/admin/companies/{id}/status", target.getId())
                .header("Authorization", bearerToken(actor)).contentType("application/json")
                .content("{\"status\":\"" + status + "\"}")).andReturn().getResponse().getStatus();
    }

    private JsonNode inbox(User user) throws Exception {
        String body = mockMvc.perform(get("/api/notifications").header("Authorization", bearerToken(user)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("data");
    }

    private long count(User user) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM notifications WHERE user_id=?", Long.class, user.getId());
    }

    private List<Map<String, Object>> notificationRows(User user) {
        return jdbcTemplate.queryForList("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC", user.getId());
    }

    private void setPreferences(User user, boolean application, boolean job, boolean recommendation, boolean system) {
        jdbcTemplate.update("""
                INSERT INTO user_notification_settings
                    (user_id, application_status_enabled, job_status_enabled, recommendation_enabled, system_enabled)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE SET application_status_enabled = EXCLUDED.application_status_enabled,
                    job_status_enabled = EXCLUDED.job_status_enabled,
                    recommendation_enabled = EXCLUDED.recommendation_enabled,
                    system_enabled = EXCLUDED.system_enabled
                """, user.getId(), application, job, recommendation, system);
    }

    private CvFile readyCv(Student owner) {
        CvFile cv = createCv(owner, "ready-" + owner.getId() + ".pdf", true);
        cv.setExtractedText("Java backend engineer");
        cv.setProcessedText("java backend engineer");
        cv.setExtractedSkills(List.of("java"));
        cv.setAnalysisStatus(CvAnalysisStatus.READY);
        cv.setLanguageCode("en");
        cv.setLanguageConfidence(new BigDecimal("0.99"));
        cv.setProcessingVersion("bilingual-nlp-v2-skills-v1");
        return cvFileRepository.saveAndFlush(cv);
    }

    private GenerateRecommendationRequest request(CvFile cv) {
        GenerateRecommendationRequest request = new GenerateRecommendationRequest();
        request.setCvId(cv.getId());
        return request;
    }

    private void stubAiSuccess() {
        when(aiServiceClient.recommendV3(any(AiRecommendationV3Request.class))).thenAnswer(invocation -> {
            AiRecommendationV3Request request = invocation.getArgument(0);
            AiRecommendationV3Request.JobInput job = request.jobs().getFirst();
            BigDecimal textScore = new BigDecimal("0.33333333");
            return new AiRecommendationV3Response(request.requestId(), "tfidf-cosine-hybrid", "bilingual-recommendation-v3",
                    List.of(new AiRecommendationV3Response.Result(job.id(), RecommendationRankingTier.PRIMARY,
                            textScore, textScore, textScore, BigDecimal.ZERO.setScale(8),
                            RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), job.skills(), "Java overlap")));
        });
    }
}
