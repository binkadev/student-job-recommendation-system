package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CvAnalysisRecommendationApiIT extends AbstractPostgresWebIntegrationTest {

    private static final ObjectMapper STUB_MAPPER = new ObjectMapper();
    private static final AtomicReference<StubHandler> PARSE_HANDLER = new AtomicReference<>();
    private static final AtomicReference<StubHandler> RECOMMEND_HANDLER = new AtomicReference<>();
    private static final AtomicReference<JsonNode> LAST_RECOMMENDATION_REQUEST = new AtomicReference<>();
    private static final ExecutorService AI_EXECUTOR = Executors.newCachedThreadPool();
    private static final HttpServer AI_SERVER = startAiServer();

    @Autowired
    private RecommendationRunRepository recommendationRunRepository;

    @Autowired
    private RecommendationResultRepository recommendationResultRepository;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private StudentSkillRepository studentSkillRepository;

    @Autowired
    private JobSkillRepository jobSkillRepository;

    @DynamicPropertySource
    static void configureAiService(DynamicPropertyRegistry registry) {
        registry.add(
                "app.ai-service.base-url",
                () -> "http://127.0.0.1:" + AI_SERVER.getAddress().getPort()
        );
        registry.add("app.ai-service.connect-timeout", () -> "500ms");
        registry.add("app.ai-service.read-timeout", () -> "2s");
    }

    @BeforeEach
    void resetAiStub() {
        LAST_RECOMMENDATION_REQUEST.set(null);
        PARSE_HANDLER.set(exchange -> respond(exchange, 200, """
                {
                  "rawText": "Raw Java CV",
                  "processedText": "java spring boot postgresql",
                  "skills": ["Java", "Spring Boot", "PostgreSQL"]
                }
                """));
        RECOMMEND_HANDLER.set(this::respondWithDeterministicRecommendations);
    }

    @AfterAll
    static void stopAiServer() {
        AI_SERVER.stop(0);
        AI_EXECUTOR.shutdownNow();
    }

    @Test
    void cvOwnerCanReadAndPatchWhileForeignAndMissingIdsAreIndistinguishable() throws Exception {
        Student owner = createStudent("analysis-owner@example.test");
        Student other = createStudent("analysis-other@example.test");
        CvFile cvFile = readyCv(owner, "analysis-owner.pdf");
        addStudentSkill(owner, "Java", SkillSource.MANUAL);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/analysis", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cvId").value(cvFile.getId()))
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.skills[0]").value("java"))
                .andExpect(jsonPath("$.data.filePath").doesNotExist())
                .andExpect(jsonPath("$.data.studentId").doesNotExist());

        mockMvc.perform(patch("/api/students/me/cv/{cvId}/extracted-data", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "extractedText": "  updated raw text  ",
                                  "processedText": "  updated processed text  "
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.extractedText").value("updated raw text"))
                .andExpect(jsonPath("$.data.processedText").value("updated processed text"));
        CvFile updated = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(updated.getExtractedText()).isEqualTo("updated raw text");
        assertThat(updated.getProcessedText()).isEqualTo("updated processed text");

        mockMvc.perform(patch("/api/students/me/cv/{cvId}/extracted-data", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skills\":[\"Injected\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        MvcResult foreign = mockMvc.perform(get("/api/students/me/cv/{cvId}/analysis", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isNotFound())
                .andReturn();
        MvcResult missing = mockMvc.perform(get("/api/students/me/cv/{cvId}/analysis", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isNotFound())
                .andReturn();
        assertThat(foreign.getResponse().getContentAsString())
                .isEqualTo(missing.getResponse().getContentAsString());
    }

    @Test
    void reanalysisPersistsBothTextsAndFailureDoesNotPartiallyUpdateOrReplaceSkills() throws Exception {
        Student student = createStudent("reanalyze@example.test");
        CvFile cvFile = readyCv(student, "reanalyze.pdf");
        writeCvFile(cvFile, "%PDF-test".getBytes(StandardCharsets.UTF_8));
        StudentSkill manualSkill = addStudentSkill(student, "Docker", SkillSource.MANUAL);

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.extractedText").value("Raw Java CV"))
                .andExpect(jsonPath("$.data.processedText").value("java spring boot postgresql"))
                .andExpect(jsonPath("$.data.skills[0]").value("docker"));
        CvFile analyzed = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(analyzed.getExtractedText()).isEqualTo("Raw Java CV");
        assertThat(analyzed.getProcessedText()).isEqualTo("java spring boot postgresql");
        assertThat(studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId()))
                .extracting(StudentSkill::getId)
                .containsExactly(manualSkill.getId());

        PARSE_HANDLER.set(exchange -> respond(exchange, 500, "{\"detail\":\"private stack\"}"));
        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("AI_SERVICE_UNAVAILABLE"))
                .andExpect(jsonPath("$.message").value("AI service is unavailable"));
        CvFile afterFailure = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(afterFailure.getExtractedText()).isEqualTo("Raw Java CV");
        assertThat(afterFailure.getProcessedText()).isEqualTo("java spring boot postgresql");
    }

    @Test
    void generationUsesJwtOwnershipStrictRequestAndStudentRole() throws Exception {
        Student owner = createStudent("generation-owner@example.test");
        Student other = createStudent("generation-other@example.test");
        CvFile otherCv = readyCv(other, "foreign-generation.pdf");
        Company company = createCompany("generation-company@example.test", "Generation Company", CompanyStatus.VERIFIED);

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cvId": %d,
                                  "studentId": %d,
                                  "userId": %d
                                }
                                """.formatted(otherCv.getId(), other.getId(), other.getUser().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));

        MvcResult foreignCv = mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + otherCv.getId() + "}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();
        MvcResult missingCv = mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + Long.MAX_VALUE + "}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();
        assertThat(foreignCv.getResponse().getContentAsString())
                .isEqualTo(missingCv.getResponse().getContentAsString());
        assertThat(recommendationRunRepository.count()).isZero();

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + otherCv.getId() + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        var admin = createUser("generation-admin@example.test", com.tttn.jobrecommendation.common.enums.UserRole.ADMIN);
        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + otherCv.getId() + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void generationSubmitsOnlyEligibleJobsAndPersistsDeterministicSuccess() throws Exception {
        Student student = createStudent("eligible-student@example.test");
        CvFile cvFile = readyCv(student, "eligible.pdf");
        addStudentSkill(student, "Java", SkillSource.MANUAL);
        Company verified = createCompany("eligible-verified@example.test", "Verified", CompanyStatus.VERIFIED);
        Company unverified = createCompany("eligible-pending@example.test", "Pending", CompanyStatus.PENDING);

        Job nullDeadline = createJob(verified, "Null deadline", JobStatus.ACTIVE);
        Job todayDeadline = createJob(verified, "Today deadline", JobStatus.ACTIVE);
        todayDeadline.setDeadline(LocalDate.now());
        jobRepository.saveAndFlush(todayDeadline);
        Job futureDeadline = createJob(verified, "Future deadline", JobStatus.ACTIVE);
        futureDeadline.setDeadline(LocalDate.now().plusDays(1));
        jobRepository.saveAndFlush(futureDeadline);
        Job expired = createJob(verified, "Expired", JobStatus.ACTIVE);
        expired.setDeadline(LocalDate.now().minusDays(1));
        jobRepository.saveAndFlush(expired);
        Job draft = createJob(verified, "Draft", JobStatus.DRAFT);
        Job closed = createJob(verified, "Closed", JobStatus.CLOSED);
        Job pendingCompany = createJob(unverified, "Unverified", JobStatus.ACTIVE);
        addJobSkill(nullDeadline, "Java");

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.totalRecommended").value(3))
                .andExpect(jsonPath("$.data.results[0].jobId").value(nullDeadline.getId()))
                .andExpect(jsonPath("$.data.results[0].score").value(0.5))
                .andExpect(jsonPath("$.data.results[0].rankPosition").value(1));

        JsonNode request = LAST_RECOMMENDATION_REQUEST.get();
        assertThat(request.get("threshold").decimalValue()).isEqualByComparingTo("0.1");
        assertThat(request.get("limit").asInt()).isEqualTo(20);
        assertThat(ids(request.get("jobs")))
                .containsExactly(nullDeadline.getId(), todayDeadline.getId(), futureDeadline.getId())
                .doesNotContain(expired.getId(), draft.getId(), closed.getId(), pendingCompany.getId());
        assertThat(request.toString()).doesNotContain("studentId", "userId", "Bearer");

        RecommendationRun run = recommendationRunRepository.findAll().getFirst();
        assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(run.getFinishedAt()).isNotNull();
        assertThat(recommendationResultRepository.findByRunIdOrderByRankPositionAsc(run.getId()))
                .hasSize(3)
                .allSatisfy(result -> assertThat(result.getScore())
                        .isBetween(new java.math.BigDecimal("0.00000"), new java.math.BigDecimal("1.00000")));

        mockMvc.perform(get("/api/students/me/recommendation-runs")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("SUCCESS"));
        mockMvc.perform(get("/api/students/me/recommendation-results/latest")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(3));
    }

    @Test
    void processingRunIsCommittedBeforeExternalCall() throws Exception {
        Student student = createStudent("processing-commit@example.test");
        CvFile cvFile = readyCv(student, "processing.pdf");
        createJob(
                createCompany("processing-company@example.test", "Processing", CompanyStatus.VERIFIED),
                "Processing Job",
                JobStatus.ACTIVE
        );
        CountDownLatch requestReceived = new CountDownLatch(1);
        CountDownLatch releaseResponse = new CountDownLatch(1);
        RECOMMEND_HANDLER.set(exchange -> {
            requestReceived.countDown();
            if (!releaseResponse.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Test did not release AI response");
            }
            respondWithDeterministicRecommendations(exchange);
        });

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            CompletableFuture<MvcResult> apiCall = CompletableFuture.supplyAsync(() -> {
                try {
                    return mockMvc.perform(post("/api/students/me/recommendations/generate")
                                    .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"cvId\":" + cvFile.getId() + "}"))
                            .andReturn();
                } catch (Exception exception) {
                    throw new RuntimeException(exception);
                }
            }, executor);

            assertThat(requestReceived.await(5, TimeUnit.SECONDS)).isTrue();
            List<RecommendationRun> visibleRuns = recommendationRunRepository.findAll();
            assertThat(visibleRuns).hasSize(1);
            assertThat(visibleRuns.getFirst().getStatus()).isEqualTo(RecommendationRunStatus.PROCESSING);

            releaseResponse.countDown();
            assertThat(apiCall.get(5, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
        } finally {
            releaseResponse.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void invalidDuplicateResponseLeavesNoPartialResultsAndPersistsSanitizedFailure() throws Exception {
        Student student = createStudent("duplicate-response@example.test");
        CvFile cvFile = readyCv(student, "duplicate.pdf");
        Job job = createJob(
                createCompany("duplicate-company@example.test", "Duplicate", CompanyStatus.VERIFIED),
                "Duplicate Job",
                JobStatus.ACTIVE
        );
        RECOMMEND_HANDLER.set(exchange -> {
            JsonNode request = readRequest(exchange);
            String requestId = request.get("requestId").asText();
            respond(exchange, 200, """
                    {
                      "requestId": "%s",
                      "algorithmVersion": "tfidf-cosine-v1",
                      "results": [
                        {
                          "jobId": %d,
                          "score": 0.8,
                          "rank": 1,
                          "matchedSkills": ["Java"],
                          "missingSkills": [],
                          "reason": "first"
                        },
                        {
                          "jobId": %d,
                          "score": 0.7,
                          "rank": 2,
                          "matchedSkills": ["Java"],
                          "missingSkills": [],
                          "reason": "duplicate"
                        }
                      ]
                    }
                    """.formatted(requestId, job.getId(), job.getId()));
        });

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.errorCode").value("AI_SERVICE_INVALID_RESPONSE"))
                .andExpect(jsonPath("$.message").value("AI service returned an invalid response"));

        RecommendationRun failedRun = recommendationRunRepository.findAll().getFirst();
        assertThat(failedRun.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(failedRun.getFinishedAt()).isNotNull();
        assertThat(failedRun.getErrorMessage())
                .isEqualTo("AI service returned an invalid response")
                .doesNotContain("duplicate", "resume", "jdbc");
        assertThat(recommendationResultRepository.count()).isZero();
    }

    @Test
    void exactBoundaryScoresRemainWithinDatabaseScaleAndAreReranked() throws Exception {
        Student student = createStudent("boundary-score@example.test");
        CvFile cvFile = readyCv(student, "boundary-score.pdf");
        Company company = createCompany("boundary-company@example.test", "Boundary", CompanyStatus.VERIFIED);
        Job firstJob = createJob(company, "Zero Score", JobStatus.ACTIVE);
        Job secondJob = createJob(company, "One Score", JobStatus.ACTIVE);
        RECOMMEND_HANDLER.set(exchange -> {
            JsonNode request = readRequest(exchange);
            respond(exchange, 200, """
                    {
                      "requestId": "%s",
                      "algorithmVersion": "tfidf-cosine-v1",
                      "results": [
                        {
                          "jobId": %d,
                          "score": 0.0,
                          "rank": 1,
                          "matchedSkills": ["Java"],
                          "missingSkills": [],
                          "reason": "zero"
                        },
                        {
                          "jobId": %d,
                          "score": 1.0,
                          "rank": 2,
                          "matchedSkills": ["Java"],
                          "missingSkills": [],
                          "reason": "one"
                        }
                      ]
                    }
                    """.formatted(request.get("requestId").asText(), firstJob.getId(), secondJob.getId()));
        });

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + ",\"threshold\":0.0,\"limit\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.results[0].jobId").value(secondJob.getId()))
                .andExpect(jsonPath("$.data.results[0].score").value(1.0))
                .andExpect(jsonPath("$.data.results[0].rankPosition").value(1))
                .andExpect(jsonPath("$.data.results[1].jobId").value(firstJob.getId()))
                .andExpect(jsonPath("$.data.results[1].score").value(0.0))
                .andExpect(jsonPath("$.data.results[1].rankPosition").value(2));

        Long runId = recommendationRunRepository.findAll().getFirst().getId();
        assertThat(recommendationResultRepository.findByRunIdOrderByRankPositionAsc(runId))
                .extracting(result -> result.getScore().toPlainString())
                .containsExactly("1.00000", "0.00000");
    }

    @Test
    void emptyEligibleCorpusIsSuccessfulAndTransportFailureMarksRunFailed() throws Exception {
        Student student = createStudent("empty-result@example.test");
        CvFile cvFile = readyCv(student, "empty-result.pdf");

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.totalRecommended").value(0))
                .andExpect(jsonPath("$.data.results.length()").value(0));

        createJob(
                createCompany("transport-company@example.test", "Transport", CompanyStatus.VERIFIED),
                "Transport Job",
                JobStatus.ACTIVE
        );
        RECOMMEND_HANDLER.set(exchange -> respond(exchange, 500, "{\"detail\":\"secret stack\"}"));
        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("AI_SERVICE_UNAVAILABLE"));

        List<RecommendationRun> runs = recommendationRunRepository.findByStudentIdOrderByCreatedAtDesc(student.getId());
        assertThat(runs).extracting(RecommendationRun::getStatus)
                .containsExactly(RecommendationRunStatus.FAILED, RecommendationRunStatus.SUCCESS);
        assertThat(runs.getFirst().getErrorMessage())
                .isEqualTo("AI service is unavailable")
                .doesNotContain("secret", "stack");
        assertThat(recommendationResultRepository.count()).isZero();
    }

    @Test
    void runDetailHidesForeignAndMissingRunsAndSeparateRequestsDoNotCorruptEachOther() throws Exception {
        Student owner = createStudent("run-owner@example.test");
        Student other = createStudent("run-other@example.test");
        CvFile cvFile = readyCv(owner, "run-owner.pdf");
        createJob(
                createCompany("run-company@example.test", "Run Company", CompanyStatus.VERIFIED),
                "Run Job",
                JobStatus.ACTIVE
        );

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<MvcResult> first = generateAsync(owner, cvFile, executor);
            CompletableFuture<MvcResult> second = generateAsync(owner, cvFile, executor);
            assertThat(first.get(10, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
            assertThat(second.get(10, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
        } finally {
            executor.shutdownNow();
        }
        List<RecommendationRun> runs = recommendationRunRepository.findAll();
        assertThat(runs).hasSize(2).allSatisfy(run ->
                assertThat(recommendationResultRepository.countByRunId(run.getId())).isEqualTo(1));

        Long runId = runs.getFirst().getId();
        mockMvc.perform(get("/api/students/me/recommendation-runs/{runId}", runId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(runId))
                .andExpect(jsonPath("$.data.results.length()").value(1));

        MvcResult foreign = mockMvc.perform(get("/api/students/me/recommendation-runs/{runId}", runId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RECOMMENDATION_RUN_NOT_FOUND"))
                .andReturn();
        MvcResult missing = mockMvc.perform(get("/api/students/me/recommendation-runs/{runId}", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RECOMMENDATION_RUN_NOT_FOUND"))
                .andReturn();
        assertThat(foreign.getResponse().getContentAsString())
                .isEqualTo(missing.getResponse().getContentAsString());
    }

    private CompletableFuture<MvcResult> generateAsync(
            Student student,
            CvFile cvFile,
            ExecutorService executor
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return mockMvc.perform(post("/api/students/me/recommendations/generate")
                                .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"cvId\":" + cvFile.getId() + "}"))
                        .andReturn();
            } catch (Exception exception) {
                throw new RuntimeException(exception);
            }
        }, executor);
    }

    private CvFile readyCv(Student student, String fileName) {
        CvFile cvFile = createCv(student, fileName, true);
        cvFile.setExtractedText("existing raw");
        cvFile.setProcessedText("java spring boot");
        return cvFileRepository.saveAndFlush(cvFile);
    }

    private StudentSkill addStudentSkill(Student student, String name, SkillSource source) {
        Skill skill = saveSkill(name);
        return studentSkillRepository.saveAndFlush(StudentSkill.builder()
                .student(student)
                .skill(skill)
                .level(SkillLevel.INTERMEDIATE)
                .source(source)
                .build());
    }

    private void addJobSkill(Job job, String name) {
        jobSkillRepository.saveAndFlush(JobSkill.builder()
                .job(job)
                .skill(saveSkill(name))
                .importance(SkillImportance.REQUIRED)
                .build());
    }

    private Skill saveSkill(String name) {
        return skillRepository.findByNormalizedName(name.toLowerCase())
                .orElseGet(() -> skillRepository.saveAndFlush(Skill.builder()
                        .name(name)
                        .normalizedName(name.toLowerCase())
                        .build()));
    }

    private void respondWithDeterministicRecommendations(HttpExchange exchange) throws Exception {
        JsonNode request = readRequest(exchange);
        LAST_RECOMMENDATION_REQUEST.set(request);
        List<Long> jobIds = ids(request.get("jobs"));
        List<String> results = new ArrayList<>();
        for (int index = jobIds.size() - 1; index >= 0; index--) {
            results.add("""
                    {
                      "jobId": %d,
                      "score": 0.5,
                      "rank": %d,
                      "matchedSkills": ["Java"],
                      "missingSkills": [],
                      "reason": "Matched Java"
                    }
                    """.formatted(jobIds.get(index), jobIds.size() - index));
        }
        respond(exchange, 200, """
                {
                  "requestId": "%s",
                  "algorithmVersion": "tfidf-cosine-v1",
                  "results": [%s]
                }
                """.formatted(request.get("requestId").asText(), String.join(",", results)));
    }

    private static List<Long> ids(JsonNode array) {
        List<Long> ids = new ArrayList<>();
        array.forEach(node -> ids.add(node.has("id") ? node.get("id").asLong() : node.asLong()));
        return ids;
    }

    private static JsonNode readRequest(HttpExchange exchange) throws IOException {
        return STUB_MAPPER.readTree(exchange.getRequestBody());
    }

    private static HttpServer startAiServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/internal/v1/cv/parse", exchange -> dispatch(PARSE_HANDLER, exchange));
            server.createContext("/internal/v1/recommendations", exchange -> dispatch(RECOMMEND_HANDLER, exchange));
            server.setExecutor(AI_EXECUTOR);
            server.start();
            return server;
        } catch (IOException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private static void dispatch(AtomicReference<StubHandler> handler, HttpExchange exchange) throws IOException {
        try {
            handler.get().handle(exchange);
        } catch (Exception exception) {
            if (exchange.getResponseCode() == -1) {
                respond(exchange, 500, "{\"error\":\"stub failure\"}");
            }
        }
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    @FunctionalInterface
    private interface StubHandler {
        void handle(HttpExchange exchange) throws Exception;
    }
}
