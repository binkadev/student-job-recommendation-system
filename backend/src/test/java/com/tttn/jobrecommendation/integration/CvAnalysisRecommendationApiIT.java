package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import com.tttn.jobrecommendation.common.enums.SkillImportance;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.JobSkill;
import com.tttn.jobrecommendation.modules.job.repository.JobSkillRepository;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
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
    private static final AtomicInteger RECOMMENDATION_CALLS = new AtomicInteger();
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
        RECOMMENDATION_CALLS.set(0);
        PARSE_HANDLER.set(exchange -> respond(exchange, 200, """
                {
                  "rawText": "Raw Java CV",
                  "processedText": "java spring boot postgresql",
                  "skills": [" Java ", "Spring   Boot", "PostgreSQL", "java"],
                  "languageCode": "EN",
                  "languageConfidence": 0.98,
                  "processingVersion": "bilingual-nlp-v2-skills-v1",
                  "warnings": [" Layout fallback used "]
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
    void cvOwnerCanReadWhileManualPatchIsOwnershipFirstAndUnsupported() throws Exception {
        Student owner = createStudent("analysis-owner@example.test");
        Student other = createStudent("analysis-other@example.test");
        CvFile cvFile = readyCv(owner, "analysis-owner.pdf");
        addStudentSkill(owner, "Docker", SkillSource.MANUAL);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/analysis", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cvId").value(cvFile.getId()))
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.skills[0]").value("java"))
                .andExpect(jsonPath("$.data.filePath").doesNotExist())
                .andExpect(jsonPath("$.data.storedFileName").doesNotExist())
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
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.errorCode").value("FEATURE_NOT_SUPPORTED"));
        CvFile updated = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(updated.getExtractedText()).isEqualTo("existing raw");
        assertThat(updated.getProcessedText()).isEqualTo("java spring boot");

        mockMvc.perform(patch("/api/students/me/cv/{cvId}/extracted-data", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skills\":[\"Injected\"]}"))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.errorCode").value("FEATURE_NOT_SUPPORTED"));

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

        mockMvc.perform(patch("/api/students/me/cv/{cvId}/extracted-data", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"extractedText\":\"probe\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

        mockMvc.perform(patch("/api/students/me/cv/{cvId}/extracted-data", cvFile.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"extractedText\":\"probe\"}"))
                .andExpect(status().isUnauthorized());

        CvFile unchanged = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(unchanged.getExtractedText()).isEqualTo("existing raw");
        assertThat(unchanged.getProcessedText()).isEqualTo("java spring boot");
        assertThat(unchanged.getExtractedSkills()).containsExactly("java", "spring boot");
    }

    @Test
    void reanalysisPersistsCvSpecificMetadataAndFailureClearsDerivedAnalysis() throws Exception {
        Student student = createStudent("reanalyze@example.test");
        CvFile cvFile = readyCv(student, "reanalyze.pdf");
        writeCvFile(cvFile, "%PDF-test".getBytes(StandardCharsets.UTF_8));
        StudentSkill manualSkill = addStudentSkill(student, "Docker", SkillSource.MANUAL);

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.extractedText").value("Raw Java CV"))
                .andExpect(jsonPath("$.data.processedText").value("java spring boot postgresql"))
                .andExpect(jsonPath("$.data.skills[0]").value("java"))
                .andExpect(jsonPath("$.data.skills[1]").value("postgresql"))
                .andExpect(jsonPath("$.data.skills[2]").value("spring boot"))
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.languageCode").value("en"))
                .andExpect(jsonPath("$.data.languageConfidence").value(0.98))
                .andExpect(jsonPath("$.data.processingVersion").value("bilingual-nlp-v2-skills-v1"))
                .andExpect(jsonPath("$.data.warnings[0]").value("Layout fallback used"))
                .andExpect(jsonPath("$.data.analyzedAt").isNotEmpty());
        CvFile analyzed = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(analyzed.getExtractedText()).isEqualTo("Raw Java CV");
        assertThat(analyzed.getProcessedText()).isEqualTo("java spring boot postgresql");
        assertThat(analyzed.getExtractedSkills()).containsExactly("java", "postgresql", "spring boot");
        assertThat(analyzed.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.READY);
        assertThat(analyzed.getLanguageCode()).isEqualTo("en");
        assertThat(analyzed.getLanguageConfidence()).isEqualByComparingTo("0.9800");
        assertThat(analyzed.getProcessingVersion()).isEqualTo("bilingual-nlp-v2-skills-v1");
        assertThat(analyzed.getAnalysisWarnings()).containsExactly("Layout fallback used");
        assertThat(analyzed.getAnalyzedAt()).isNotNull();
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
        assertThat(afterFailure.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.FAILED);
        assertThat(afterFailure.getProcessedText()).isNull();
        assertThat(afterFailure.getExtractedSkills()).isEmpty();
        assertThat(afterFailure.getLanguageCode()).isNull();
        assertThat(afterFailure.getLanguageConfidence()).isNull();
        assertThat(afterFailure.getProcessingVersion()).isNull();
        assertThat(afterFailure.getAnalysisWarnings()).isEmpty();
        assertThat(afterFailure.getAnalyzedAt()).isNull();
        assertThat(afterFailure.getAnalysisError())
                .isEqualTo("AI service is unavailable")
                .doesNotContain("private", "stack", "http");
    }

    @Test
    void blankRawTextResponseIsRejectedAndCannotPersistReadyState() throws Exception {
        Student student = createStudent("invalid-raw-text@example.test");
        CvFile cvFile = readyCv(student, "invalid-raw-text.pdf");
        writeCvFile(cvFile, "%PDF-invalid-raw".getBytes(StandardCharsets.UTF_8));
        PARSE_HANDLER.set(exchange -> respond(exchange, 200, """
                {
                  "rawText": "   ",
                  "processedText": "java spring boot",
                  "skills": ["java", "spring boot"],
                  "languageCode": "en",
                  "languageConfidence": 0.98,
                  "processingVersion": "bilingual-nlp-v2",
                  "warnings": []
                }
                """));

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.errorCode").value("AI_SERVICE_INVALID_RESPONSE"))
                .andExpect(jsonPath("$.message").value("AI service returned an invalid response"));

        CvFile failed = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(failed.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.FAILED);
        assertThat(failed.getAnalysisStatus()).isNotEqualTo(CvAnalysisStatus.READY);
        assertThat(failed.getProcessedText()).isNull();
        assertThat(failed.getExtractedSkills()).isEmpty();
        assertThat(failed.getLanguageCode()).isNull();
        assertThat(failed.getLanguageConfidence()).isNull();
        assertThat(failed.getProcessingVersion()).isNull();
        assertThat(failed.getAnalysisWarnings()).isEmpty();
        assertThat(failed.getAnalyzedAt()).isNull();
        assertThat(failed.getAnalysisError()).isEqualTo("AI service returned an invalid response");
    }

    @Test
    void twoCvsKeepDifferentExtractedSkillsAndGenerationUsesTheSelectedCv() throws Exception {
        Student student = createStudent("per-cv-skills@example.test");
        CvFile javaCv = readyCv(student, "java.pdf");
        CvFile pythonCv = readyCv(student, "python.pdf", false);
        writeCvFile(javaCv, "%PDF-java".getBytes(StandardCharsets.UTF_8));
        writeCvFile(pythonCv, "%PDF-python".getBytes(StandardCharsets.UTF_8));
        addStudentSkill(student, "Student Profile Only", SkillSource.MANUAL);

        AtomicInteger parseNumber = new AtomicInteger();
        PARSE_HANDLER.set(exchange -> {
            boolean first = parseNumber.getAndIncrement() == 0;
            respond(exchange, 200, first ? """
                    {
                      "rawText": "Java CV raw",
                      "processedText": "java spring boot",
                      "skills": ["Java", "Spring Boot"],
                      "languageCode": "en",
                      "languageConfidence": 0.97,
                      "processingVersion": "bilingual-nlp-v2-skills-v1",
                      "warnings": []
                    }
                    """ : """
                    {
                      "rawText": "Python CV raw",
                      "processedText": "python fastapi",
                      "skills": ["Python", "FastAPI"],
                      "languageCode": "en",
                      "languageConfidence": 0.96,
                      "processingVersion": "bilingual-nlp-v2-skills-v1",
                      "warnings": []
                    }
                    """);
        });

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", javaCv.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", pythonCv.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk());

        CvFile persistedJava = cvFileRepository.findById(javaCv.getId()).orElseThrow();
        CvFile persistedPython = cvFileRepository.findById(pythonCv.getId()).orElseThrow();
        assertThat(persistedJava.getExtractedSkills()).containsExactly("java", "spring boot");
        assertThat(persistedPython.getExtractedSkills()).containsExactly("fastapi", "python");

        createJob(
                createCompany("per-cv-company@example.test", "Per CV Company", CompanyStatus.VERIFIED),
                "Per CV Job",
                JobStatus.ACTIVE
        );
        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + pythonCv.getId() + "}"))
                .andExpect(status().isOk());

        JsonNode cvInput = LAST_RECOMMENDATION_REQUEST.get().get("cv");
        assertThat(cvInput.get("id").asLong()).isEqualTo(pythonCv.getId());
        assertThat(cvInput.get("processedText").asText()).isEqualTo("python fastapi");
        assertThat(idsOfText(cvInput.get("skills"))).containsExactly("fastapi", "python");
        assertThat(LAST_RECOMMENDATION_REQUEST.get().toString())
                .doesNotContain("Student Profile Only", "java", "spring boot");
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
    void generationRejectsFailedAndProcessingCvEvenWhenLegacyTextRemains() throws Exception {
        Student student = createStudent("analysis-state-gate@example.test");
        CvFile cvFile = readyCv(student, "state-gate.pdf");

        cvFile.setAnalysisStatus(CvAnalysisStatus.FAILED);
        cvFileRepository.saveAndFlush(cvFile);
        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("CV_ANALYSIS_NOT_READY"));

        cvFile.setAnalysisStatus(CvAnalysisStatus.PROCESSING);
        cvFileRepository.saveAndFlush(cvFile);
        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("CV_ANALYSIS_NOT_READY"));

        assertThat(recommendationRunRepository.count()).isZero();
        assertThat(RECOMMENDATION_CALLS).hasValue(0);
    }

    @Test
    void generationSubmitsOnlyEligibleJobsAndPersistsDeterministicSuccess() throws Exception {
        Student student = createStudent("eligible-student@example.test");
        CvFile cvFile = readyCv(student, "eligible.pdf");
        addStudentSkill(student, "Student Skill Must Not Leak", SkillSource.MANUAL);
        Company verified = createCompany("eligible-verified@example.test", "Verified", CompanyStatus.VERIFIED);
        Company unverified = createCompany("eligible-pending@example.test", "Pending", CompanyStatus.PENDING);

        Job nullDeadline = createJob(verified, "Backend Developer", JobStatus.ACTIVE);
        nullDeadline.setDescription("Build bilingual APIs");
        nullDeadline.setRequirements("Java and PostgreSQL");
        nullDeadline.setBenefits("SECRET_BENEFITS");
        nullDeadline.setLocation("SECRET_LOCATION");
        nullDeadline.setSalaryMin(new BigDecimal("12345.67"));
        nullDeadline.setPublishedAt(LocalDateTime.of(2026, 7, 1, 12, 0));
        jobRepository.saveAndFlush(nullDeadline);
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
                .andExpect(jsonPath("$.data.algorithm").value("tfidf-cosine-hybrid"))
                .andExpect(jsonPath("$.data.algorithmVersion").value("bilingual-recommendation-v3"))
                .andExpect(jsonPath("$.data.totalJobsScanned").value(3))
                .andExpect(jsonPath("$.data.totalRecommended").value(3))
                .andExpect(jsonPath("$.data.results[0].jobId").value(nullDeadline.getId()))
                .andExpect(jsonPath("$.data.results[0].score").value(0.675))
                .andExpect(jsonPath("$.data.results[0].rankingScore").value(0.675))
                .andExpect(jsonPath("$.data.results[0].overallScore").value(0.675))
                .andExpect(jsonPath("$.data.results[0].textScore").value(0.5))
                .andExpect(jsonPath("$.data.results[0].skillScore").value(1.0))
                .andExpect(jsonPath("$.data.results[0].rankingTier").value("PRIMARY"))
                .andExpect(jsonPath("$.data.results[0].tierRankPosition").value(1))
                .andExpect(jsonPath("$.data.results[0].scoringStrategy").value("SAME_LANGUAGE_HYBRID"))
                .andExpect(jsonPath("$.data.results[0].rankPosition").value(1));

        JsonNode request = LAST_RECOMMENDATION_REQUEST.get();
        assertThat(request.get("threshold").decimalValue()).isEqualByComparingTo("0.1");
        assertThat(request.get("limit").asInt()).isEqualTo(20);
        assertThat(ids(request.get("jobs")))
                .containsExactly(nullDeadline.getId(), todayDeadline.getId(), futureDeadline.getId())
                .doesNotContain(expired.getId(), draft.getId(), closed.getId(), pendingCompany.getId());
        assertThat(request.get("cv").get("processedText").asText()).isEqualTo("java spring boot");
        assertThat(request.get("cv").has("text")).isFalse();
        assertThat(request.get("cv").get("languageCode").asText()).isEqualTo("en");
        assertThat(request.get("cv").get("languageConfidence").decimalValue()).isEqualByComparingTo("0.99");
        assertThat(request.get("cv").get("processingVersion").asText())
                .isEqualTo("bilingual-nlp-v2-skills-v1");
        assertThat(idsOfText(request.get("cv").get("skills")))
                .containsExactly("java", "spring boot");
        JsonNode firstJobInput = request.get("jobs").get(0);
        assertThat(firstJobInput.has("processedText")).isFalse();
        assertThat(firstJobInput.get("text").asText()).isEqualTo("""
                TITLE:
                Backend Developer

                DESCRIPTION:
                Build bilingual APIs

                REQUIREMENTS:
                Java and PostgreSQL

                SKILLS:
                java""");
        assertThat(firstJobInput.get("text").asText())
                .doesNotContain(
                        "SECRET_BENEFITS",
                        "SECRET_LOCATION",
                        "12345.67",
                        "Verified",
                        "2026-07-01",
                        "REMOTE"
                );
        assertThat(request.toString())
                .doesNotContain("studentId", "userId", "Bearer", "Student Skill Must Not Leak");

        RecommendationRun run = recommendationRunRepository.findAll().getFirst();
        assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(run.getAlgorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(run.getAlgorithmVersion()).isEqualTo("bilingual-recommendation-v3");
        assertThat(run.getTotalJobsScanned()).isEqualTo(3);
        assertThat(run.getFinishedAt()).isNotNull();
        List<RecommendationResult> persistedResults = recommendationResultRepository
                .findByRunIdOrderByRankPositionAsc(run.getId());
        assertThat(persistedResults).hasSize(3);
        assertThat(persistedResults.getFirst().getScore()).isEqualByComparingTo("0.67500");
        assertThat(persistedResults.getFirst().getOverallScore()).isEqualByComparingTo("0.67500");
        assertThat(persistedResults.getFirst().getTextScore()).isEqualByComparingTo("0.50000");
        assertThat(persistedResults.getFirst().getSkillScore()).isEqualByComparingTo("1.00000");
        assertThat(persistedResults.getFirst().getMatchedKeywords()).containsExactly("java");
        assertThat(persistedResults.getFirst().getMissingSkills()).isEmpty();
        assertThat(persistedResults).allSatisfy(result -> {
            assertThat(result.getScoringStrategy().name()).isEqualTo("SAME_LANGUAGE_HYBRID");
            assertThat(result.getReason()).isEqualTo("Matched Java");
        });

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
                      "algorithm": "tfidf-cosine-hybrid",
                      "algorithmVersion": "bilingual-recommendation-v3",
                      "results": [
                        {
                          "jobId": %d,
                          "rankingTier": "PRIMARY",
                          "rankingScore": 0.8,
                          "overallScore": 0.8,
                          "textScore": 0.8,
                          "skillScore": 0.0,
                          "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                          "matchedSkills": [],
                          "missingSkills": [],
                          "reason": "first"
                        },
                        {
                          "jobId": %d,
                          "rankingTier": "PRIMARY",
                          "rankingScore": 0.7,
                          "overallScore": 0.7,
                          "textScore": 0.7,
                          "skillScore": 0.0,
                          "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                          "matchedSkills": [],
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
    void oneResultBelowRequestedThresholdFailsRunWithoutPersistingAnyResult() throws Exception {
        Student student = createStudent("threshold-response@example.test");
        CvFile cvFile = readyCv(student, "threshold-response.pdf");
        Company company = createCompany(
                "threshold-company@example.test",
                "Threshold",
                CompanyStatus.VERIFIED
        );
        Job acceptedJob = createJob(company, "Above threshold", JobStatus.ACTIVE);
        Job rejectedJob = createJob(company, "Below threshold", JobStatus.ACTIVE);
        RECOMMEND_HANDLER.set(exchange -> {
            JsonNode request = readRequest(exchange);
            respond(exchange, 200, """
                    {
                      "requestId": "%s",
                      "algorithm": "tfidf-cosine-hybrid",
                      "algorithmVersion": "bilingual-recommendation-v3",
                      "results": [
                        {
                          "jobId": %d,
                          "rankingTier": "PRIMARY",
                          "rankingScore": 0.9,
                          "overallScore": 0.9,
                          "textScore": 0.9,
                          "skillScore": 0.0,
                          "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                          "matchedSkills": [],
                          "missingSkills": [],
                          "reason": "above"
                        },
                        {
                          "jobId": %d,
                          "rankingTier": "PRIMARY",
                          "rankingScore": 0.599999,
                          "overallScore": 0.599999,
                          "textScore": 0.599999,
                          "skillScore": 0.0,
                          "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                          "matchedSkills": [],
                          "missingSkills": [],
                          "reason": "below"
                        }
                      ]
                    }
                    """.formatted(
                    request.get("requestId").asText(),
                    acceptedJob.getId(),
                    rejectedJob.getId()
            ));
        });

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + ",\"threshold\":0.6,\"limit\":2}"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.errorCode").value("AI_SERVICE_INVALID_RESPONSE"))
                .andExpect(jsonPath("$.message").value("AI service returned an invalid response"));

        RecommendationRun failedRun = recommendationRunRepository.findAll().getFirst();
        assertThat(failedRun.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(failedRun.getFinishedAt()).isNotNull();
        assertThat(failedRun.getErrorMessage()).isEqualTo("AI service returned an invalid response");
        assertThat(recommendationResultRepository.count()).isZero();
    }

    @Test
    void exactBoundaryScoresArePersistedAndRankedByBackendScoreDescending() throws Exception {
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
                      "algorithm": "tfidf-cosine-hybrid",
                      "algorithmVersion": "bilingual-recommendation-v3",
                      "results": [
                        {
                          "jobId": %d,
                          "rankingTier": "FALLBACK",
                          "rankingScore": 0.0,
                          "overallScore": null,
                          "textScore": null,
                          "skillScore": 0.0,
                          "scoringStrategy": "CROSS_LANGUAGE_SKILL_BASED",
                          "matchedSkills": [],
                          "missingSkills": [],
                          "reason": "zero"
                        },
                        {
                          "jobId": %d,
                          "rankingTier": "PRIMARY",
                          "rankingScore": 1.0,
                          "overallScore": 1.0,
                          "textScore": 1.0,
                          "skillScore": 0.0,
                          "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                          "matchedSkills": [],
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
                .andExpect(jsonPath("$.data.algorithm").value("tfidf-cosine-hybrid"))
                .andExpect(jsonPath("$.data.algorithmVersion").value("bilingual-recommendation-v3"))
                .andExpect(jsonPath("$.data.totalJobsScanned").value(0))
                .andExpect(jsonPath("$.data.totalRecommended").value(0))
                .andExpect(jsonPath("$.data.results.length()").value(0));
        assertThat(RECOMMENDATION_CALLS).hasValue(0);
        RecommendationRun emptyRun = recommendationRunRepository.findAll().getFirst();
        assertThat(emptyRun.getStatus()).isEqualTo(RecommendationRunStatus.SUCCESS);
        assertThat(emptyRun.getAlgorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(emptyRun.getAlgorithmVersion()).isEqualTo("bilingual-recommendation-v3");
        assertThat(emptyRun.getTotalJobsScanned()).isZero();
        assertThat(emptyRun.getFinishedAt()).isNotNull();
        assertThat(emptyRun.getErrorMessage()).isNull();

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
        assertThat(RECOMMENDATION_CALLS).hasValue(1);

        List<RecommendationRun> runs = recommendationRunRepository.findByStudentIdOrderByCreatedAtDesc(student.getId());
        assertThat(runs).extracting(RecommendationRun::getStatus)
                .containsExactly(RecommendationRunStatus.FAILED, RecommendationRunStatus.SUCCESS);
        assertThat(runs.getFirst().getErrorMessage())
                .isEqualTo("AI service is unavailable")
                .doesNotContain("secret", "stack");
        assertThat(recommendationResultRepository.count()).isZero();
    }

    @Test
    void latestResultsIgnoreNewerFailedAndProcessingRunsWhileDetailsRemainReadable() throws Exception {
        Student student = createStudent("latest-success@example.test");
        CvFile cvFile = readyCv(student, "latest-success.pdf");
        Job successfulJob = createJob(
                createCompany("latest-company@example.test", "Latest Company", CompanyStatus.VERIFIED),
                "Successful Recommendation",
                JobStatus.ACTIVE
        );

        mockMvc.perform(post("/api/students/me/recommendations/generate")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":" + cvFile.getId() + "}"))
                .andExpect(status().isOk());

        RecommendationRun failed = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.FAILED)
                .totalJobsScanned(1)
                .finishedAt(LocalDateTime.now())
                .errorMessage("AI service is unavailable")
                .build());
        RecommendationRun processing = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.PROCESSING)
                .totalJobsScanned(1)
                .build());

        mockMvc.perform(get("/api/students/me/recommendation-results/latest")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].jobId").value(successfulJob.getId()))
                .andExpect(jsonPath("$.data[0].reason").value("Matched Java"));

        mockMvc.perform(get("/api/students/me/recommendation-runs/{runId}", failed.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FAILED"))
                .andExpect(jsonPath("$.data.errorMessage").value("AI service is unavailable"))
                .andExpect(jsonPath("$.data.results.length()").value(0));
        mockMvc.perform(get("/api/students/me/recommendation-runs/{runId}", processing.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.results.length()").value(0));
    }

    @Test
    void legacyRecommendationRowsWithNullV2MetadataRemainReadable() throws Exception {
        Student student = createStudent("legacy-result@example.test");
        CvFile cvFile = readyCv(student, "legacy-result.pdf");
        Job job = createJob(
                createCompany("legacy-result-company@example.test", "Legacy Result", CompanyStatus.VERIFIED),
                "Legacy Job",
                JobStatus.ACTIVE
        );
        RecommendationRun run = recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.SUCCESS)
                .finishedAt(LocalDateTime.now())
                .build());
        recommendationResultRepository.saveAndFlush(RecommendationResult.builder()
                .run(run)
                .job(job)
                .score(new BigDecimal("0.75000"))
                .matchedKeywords(null)
                .missingSkills(List.of())
                .rankPosition(1)
                .build());

        mockMvc.perform(get("/api/students/me/recommendation-runs/{runId}", run.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.algorithm").doesNotExist())
                .andExpect(jsonPath("$.data.algorithmVersion").doesNotExist())
                .andExpect(jsonPath("$.data.totalJobsScanned").value(0))
                .andExpect(jsonPath("$.data.results[0].score").value(0.75))
                .andExpect(jsonPath("$.data.results[0].rankingScore").value(0.75))
                .andExpect(jsonPath("$.data.results[0].rankingTier").isEmpty())
                .andExpect(jsonPath("$.data.results[0].overallScore").isEmpty())
                .andExpect(jsonPath("$.data.results[0].tierRankPosition").isEmpty())
                .andExpect(jsonPath("$.data.results[0].textScore").doesNotExist())
                .andExpect(jsonPath("$.data.results[0].skillScore").doesNotExist())
                .andExpect(jsonPath("$.data.results[0].scoringStrategy").doesNotExist())
                .andExpect(jsonPath("$.data.results[0].matchedKeywords.length()").value(0))
                .andExpect(jsonPath("$.data.results[0].missingSkills.length()").value(0));
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
        List<RecommendationResult> results = recommendationResultRepository.findAll();
        assertThat(runs).hasSize(2).allSatisfy(run ->
                assertThat(results)
                        .filteredOn(result -> result.getRun().getId().equals(run.getId()))
                        .hasSize(1));

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
        return readyCv(student, fileName, true);
    }

    private CvFile readyCv(Student student, String fileName, boolean active) {
        CvFile cvFile = createCv(student, fileName, active);
        cvFile.setExtractedText("existing raw");
        cvFile.setProcessedText("java spring boot");
        cvFile.setExtractedSkills(List.of("java", "spring boot"));
        cvFile.setAnalysisStatus(CvAnalysisStatus.READY);
        cvFile.setLanguageCode("en");
        cvFile.setLanguageConfidence(new BigDecimal("0.99"));
        cvFile.setProcessingVersion("bilingual-nlp-v2-skills-v1");
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
        List<String> cvSkills = idsOfText(request.get("cv").get("skills"));
        List<String> results = new ArrayList<>();
        for (JsonNode job : request.get("jobs")) {
            List<String> jobSkills = idsOfText(job.get("skills"));
            List<String> matchedSkills = jobSkills.stream().filter(cvSkills::contains).sorted().toList();
            List<String> missingSkills = jobSkills.stream().filter(skill -> !cvSkills.contains(skill)).sorted().toList();
            BigDecimal skillScore = jobSkills.isEmpty()
                    ? BigDecimal.ZERO
                    : BigDecimal.valueOf(matchedSkills.size())
                            .divide(BigDecimal.valueOf(jobSkills.size()), 8, java.math.RoundingMode.HALF_UP);
            BigDecimal textScore = new BigDecimal("0.50000000");
            BigDecimal overallScore = jobSkills.isEmpty()
                    ? textScore
                    : textScore.multiply(new BigDecimal("0.65"))
                            .add(skillScore.multiply(new BigDecimal("0.35")))
                            .setScale(8, java.math.RoundingMode.HALF_UP);
            results.add("""
                    {
                      "jobId": %d,
                      "rankingTier": "PRIMARY",
                      "rankingScore": %s,
                      "overallScore": %s,
                      "textScore": %s,
                      "skillScore": %s,
                      "scoringStrategy": "SAME_LANGUAGE_HYBRID",
                      "matchedSkills": %s,
                      "missingSkills": %s,
                      "reason": " Matched Java "
                    }
                    """.formatted(
                    job.get("id").asLong(),
                    overallScore.toPlainString(),
                    overallScore.toPlainString(),
                    textScore.toPlainString(),
                    skillScore.toPlainString(),
                    STUB_MAPPER.writeValueAsString(matchedSkills),
                    STUB_MAPPER.writeValueAsString(missingSkills)
            ));
        }
        respond(exchange, 200, """
                {
                  "requestId": "%s",
                  "algorithm": "tfidf-cosine-hybrid",
                  "algorithmVersion": "bilingual-recommendation-v3",
                  "results": [%s]
                }
                """.formatted(request.get("requestId").asText(), String.join(",", results)));
    }

    private static List<Long> ids(JsonNode array) {
        List<Long> ids = new ArrayList<>();
        array.forEach(node -> ids.add(node.has("id") ? node.get("id").asLong() : node.asLong()));
        return ids;
    }

    private static List<String> idsOfText(JsonNode array) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(node.asText()));
        return values;
    }

    private static JsonNode readRequest(HttpExchange exchange) throws IOException {
        return STUB_MAPPER.readTree(exchange.getRequestBody());
    }

    private static HttpServer startAiServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/internal/v2/cv/parse", exchange -> dispatch(PARSE_HANDLER, exchange));
            server.createContext("/internal/v3/recommendations", exchange -> {
                RECOMMENDATION_CALLS.incrementAndGet();
                dispatch(RECOMMEND_HANDLER, exchange);
            });
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
