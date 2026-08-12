package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CandidateRankingPublicApiIT extends AbstractPostgresWebIntegrationTest {

    private static final Set<String> RUN_FIELDS = Set.of(
            "id", "jobId", "jobTitle", "status", "algorithm", "algorithmVersion",
            "threshold", "requestedLimit", "requestedPrimaryLimit", "requestedFallbackLimit", "totalApplicationsScanned", "eligibleCandidates",
            "skippedNoCv", "skippedNotReady", "skippedTerminalStatus", "totalRanked",
            "errorMessage", "startedAt", "finishedAt", "createdAt"
    );
    private static final Set<String> RESULT_FIELDS = Set.of(
            "id", "applicationId", "studentId", "studentName", "studentEmail",
            "cvFileId", "cvFileName", "applicationStatus", "appliedAt", "rankingTier", "rankingScore", "overallScore", "tierRankPosition", "score",
            "textScore", "skillScore", "scoringStrategy", "matchedSkills", "missingSkills",
            "reason", "rankPosition", "createdAt"
    );

    @MockitoBean
    private AiServiceClient aiServiceClient;

    @Autowired
    private CandidateRankingRunRepository runRepository;

    @Autowired
    private CandidateRankingResultRepository resultRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Company owner;
    private Company otherCompany;
    private Job ownedJob;
    private Job foreignJob;
    private Student studentUser;

    @BeforeEach
    void createFixtures() {
        owner = createCompany("ranking-api-owner@example.test", "Ranking Owner", CompanyStatus.VERIFIED);
        otherCompany = createCompany("ranking-api-other@example.test", "Ranking Other", CompanyStatus.VERIFIED);
        ownedJob = createJob(owner, "Backend Intern", JobStatus.ACTIVE);
        foreignJob = createJob(otherCompany, "Foreign Job", JobStatus.ACTIVE);
        studentUser = createStudent("ranking-api-student@example.test");
    }

    @Test
    void allEndpointsRejectUnauthenticatedAccess() throws Exception {
        mockMvc.perform(post(basePath(ownedJob)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(basePath(ownedJob))).andExpect(status().isUnauthorized());
        mockMvc.perform(get(basePath(ownedJob) + "/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void studentRoleIsForbiddenForAllEndpoints() throws Exception {
        String token = bearerToken(studentUser.getUser());
        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, token)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
        mockMvc.perform(get(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(basePath(ownedJob) + "/1").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownerListsEmptyOneBasedPageAndPaginationIsValidated() throws Exception {
        mockMvc.perform(get(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.totalItems").value(0))
                .andExpect(jsonPath("$.data.totalPages").value(0))
                .andExpect(jsonPath("$.data.items").isEmpty());

        mockMvc.perform(get(basePath(ownedJob)).param("page", "0")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
        mockMvc.perform(get(basePath(ownedJob)).param("size", "101")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"));
    }

    @Test
    void foreignAndAbsentJobsAreIdenticalForListAndDetail() throws Exception {
        String foreignList = getError(basePath(foreignJob));
        String absentList = getError("/api/companies/me/jobs/999999/candidate-ranking-runs");
        assertThat(foreignList).isEqualTo(absentList);

        String foreignDetail = getError(basePath(foreignJob) + "/123");
        String absentDetail = getError("/api/companies/me/jobs/999999/candidate-ranking-runs/123");
        assertThat(foreignDetail).isEqualTo(absentDetail);
        assertThat(objectMapper.readTree(foreignDetail).path("errorCode").asText())
                .isEqualTo("RESOURCE_NOT_FOUND");
    }

    @Test
    void foreignAndAbsentRunsAreIdenticalAndHidden() throws Exception {
        CandidateRankingRun foreignRun = createRun(foreignJob, RecommendationRunStatus.SUCCESS, null);

        String foreign = getError(basePath(ownedJob) + "/" + foreignRun.getId());
        String absent = getError(basePath(ownedJob) + "/999999");

        assertThat(foreign).isEqualTo(absent);
        JsonNode error = objectMapper.readTree(foreign);
        assertThat(error.path("errorCode").asText()).isEqualTo("CANDIDATE_RANKING_RUN_NOT_FOUND");
        assertThat(error.path("message").asText()).isEqualTo("Candidate ranking run not found");
    }

    @Test
    void listOrdersByCreatedAtThenIdAndUsesAggregateTotalRanked() throws Exception {
        CandidateRankingRun older = createRun(ownedJob, RecommendationRunStatus.SUCCESS, null);
        CandidateRankingRun tieLowerId = createRun(ownedJob, RecommendationRunStatus.SUCCESS, null);
        CandidateRankingRun tieHigherId = createRun(ownedJob, RecommendationRunStatus.SUCCESS, null);
        LocalDateTime oldTime = LocalDateTime.of(2026, 8, 1, 9, 0);
        LocalDateTime tieTime = LocalDateTime.of(2026, 8, 1, 10, 0);
        updateRunCreatedAt(older.getId(), oldTime);
        updateRunCreatedAt(tieLowerId.getId(), tieTime);
        updateRunCreatedAt(tieHigherId.getId(), tieTime);
        createRankedResult(tieHigherId, 1, "first.pdf");
        createRankedResult(tieHigherId, 2, "second.pdf");

        mockMvc.perform(get(basePath(ownedJob)).param("page", "1").param("size", "2")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.totalItems").value(3))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.items[0].id").value(tieHigherId.getId()))
                .andExpect(jsonPath("$.data.items[0].totalRanked").value(2))
                .andExpect(jsonPath("$.data.items[1].id").value(tieLowerId.getId()))
                .andExpect(jsonPath("$.data.items[1].totalRanked").value(0));
    }

    @Test
    void detailPreservesRankOrderAndExposesOnlyExactContractFields() throws Exception {
        CandidateRankingRun run = createRun(ownedJob, RecommendationRunStatus.SUCCESS, null);
        createRankedResult(run, 2, "rank-two-public.pdf");
        CandidateRankingResult first = createRankedResult(run, 1, "rank-one-public.pdf");

        MvcResult mvcResult = mockMvc.perform(get(basePath(ownedJob) + "/" + run.getId())
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRanked").value(2))
                .andExpect(jsonPath("$.data.results[0].id").value(first.getId()))
                .andExpect(jsonPath("$.data.results[0].rankPosition").value(1))
                .andExpect(jsonPath("$.data.results[1].rankPosition").value(2))
                .andExpect(jsonPath("$.data.results[0].matchedSkills[0]").value("spring boot"))
                .andExpect(jsonPath("$.data.results[0].matchedSkills[1]").value("java"))
                .andReturn();

        JsonNode data = objectMapper.readTree(mvcResult.getResponse().getContentAsString()).path("data");
        assertThat(fieldNames(data)).containsExactlyInAnyOrderElementsOf(union(RUN_FIELDS, Set.of("results")));
        assertThat(fieldNames(data.path("results").get(0)))
                .containsExactlyInAnyOrderElementsOf(RESULT_FIELDS);
        assertThat(mvcResult.getResponse().getContentAsString())
                .doesNotContain("requestId", "inputFingerprint", "jobUpdatedAtSnapshot", "storedFileName",
                        "filePath", "fileUrl", "extractedText", "processedText", "analysisError");
    }

    @Test
    void processingFailedAndSuccessEmptyRunsMapSafely() throws Exception {
        CandidateRankingRun processing = createRun(ownedJob, RecommendationRunStatus.PROCESSING, null);
        CandidateRankingRun failed = createRun(ownedJob, RecommendationRunStatus.FAILED, "AI service is unavailable");
        CandidateRankingRun emptySuccess = createRun(ownedJob, RecommendationRunStatus.SUCCESS, null);

        mockMvc.perform(get(basePath(ownedJob) + "/" + processing.getId())
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.algorithm").doesNotExist())
                .andExpect(jsonPath("$.data.algorithmVersion").doesNotExist())
                .andExpect(jsonPath("$.data.totalRanked").value(0))
                .andExpect(jsonPath("$.data.results").isEmpty());
        mockMvc.perform(get(basePath(ownedJob) + "/" + failed.getId())
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.errorMessage").value("AI service is unavailable"))
                .andExpect(jsonPath("$.data.results").isEmpty());
        mockMvc.perform(get(basePath(ownedJob) + "/" + emptySuccess.getId())
                        .header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRanked").value(0))
                .andExpect(jsonPath("$.data.results").isEmpty());
    }

    @Test
    void emptyCreateUsesDefaultsCompletesSynchronouslyAndDoesNotCallAi() throws Exception {
        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.threshold").value(0.1))
                .andExpect(jsonPath("$.data.requestedLimit").value(20))
                .andExpect(jsonPath("$.data.totalApplicationsScanned").value(0))
                .andExpect(jsonPath("$.data.eligibleCandidates").value(0))
                .andExpect(jsonPath("$.data.totalRanked").value(0))
                .andExpect(jsonPath("$.data.results").isEmpty());

        CandidateRankingRun run = runRepository.findAll().getFirst();
        assertThat(run.getThreshold()).isEqualByComparingTo("0.10000");
        assertThat(run.getRequestedLimit()).isEqualTo(20);
        verify(aiServiceClient, never()).rankCandidates(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString()
        );
    }

    @Test
    void explicitControlsReachRealOrchestrationAfterExactCanonicalization() throws Exception {
        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"threshold\":0.12345,\"limit\":37}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.threshold").value(0.12345))
                .andExpect(jsonPath("$.data.requestedLimit").value(37));

        CandidateRankingRun run = runRepository.findAll().getFirst();
        assertThat(run.getThreshold()).isEqualByComparingTo("0.12345");
        assertThat(run.getRequestedLimit()).isEqualTo(37);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"unknown\":1}",
            "{\"companyId\":1}",
            "{\"applicationIds\":[1]}",
            "{\"cvIds\":[1]}",
            "{\"threshold\":-0.1}",
            "{\"threshold\":1.1}",
            "{\"limit\":0}",
            "{\"limit\":101}",
            "{\"threshold\":null}",
            "{\"limit\":null}"
    })
    void invalidCreateBodyReturnsBadRequestBeforeGeneration(String body) throws Exception {
        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertThat(runRepository.count()).isZero();
    }

    @Test
    void nonRepresentableThresholdReturnsBadRequestWithoutCreatingRun() throws Exception {
        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"threshold\":0.123456,\"limit\":20}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
        assertThat(runRepository.count()).isZero();
    }

    @Test
    void existingProcessingCreateReturnsConflict() throws Exception {
        createRun(ownedJob, RecommendationRunStatus.PROCESSING, null);

        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("CANDIDATE_RANKING_ALREADY_PROCESSING"));
    }

    @ParameterizedTest
    @MethodSource("generationFailures")
    void generationFailuresKeepPublicErrorsAndPersistOnlySanitizedMessages(
            RuntimeException failure,
            int expectedStatus,
            String expectedCode,
            String expectedPersistedMessage
    ) throws Exception {
        Student candidate = createStudent("ranking-failure-candidate@example.test");
        CvFile cv = createCv(candidate, "failure-candidate.pdf", false);
        cv.setExtractedText("Private Java CV contents");
        cv.setProcessedText("private java cv contents");
        cv.setExtractedSkills(List.of("java"));
        cv.setAnalysisStatus(CvAnalysisStatus.READY);
        cv.setProcessingVersion("bilingual-nlp-v2-skills-v1");
        cv.setAnalyzedAt(LocalDateTime.of(2026, 8, 1, 10, 0));
        cvFileRepository.saveAndFlush(cv);
        createApplication(candidate, ownedJob, cv, ApplicationStatus.PENDING);
        when(aiServiceClient.rankCandidates(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString()
        )).thenThrow(failure);

        mockMvc.perform(post(basePath(ownedJob)).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.errorCode").value(expectedCode));

        CandidateRankingRun failed = runRepository.findAll().getFirst();
        assertThat(failed.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(failed.getErrorMessage()).isEqualTo(expectedPersistedMessage)
                .doesNotContain("Private", "contents", "internal", "configured");
        assertThat(resultRepository.findAll()).isEmpty();
    }

    @Test
    void foreignAndAbsentJobCreateResponsesAreIdentical() throws Exception {
        String foreign = postError(basePath(foreignJob), "{}");
        String absent = postError("/api/companies/me/jobs/999999/candidate-ranking-runs", "{}");
        assertThat(foreign).isEqualTo(absent);
        assertThat(objectMapper.readTree(foreign).path("errorCode").asText()).isEqualTo("RESOURCE_NOT_FOUND");
    }

    private CandidateRankingRun createRun(Job job, RecommendationRunStatus status, String errorMessage) {
        return runRepository.saveAndFlush(CandidateRankingRun.builder()
                .job(job)
                .requestId(UUID.randomUUID())
                .status(status)
                .algorithm(status == RecommendationRunStatus.PROCESSING ? null : "tfidf-cosine-hybrid")
                .algorithmVersion(status == RecommendationRunStatus.PROCESSING
                        ? null : "bilingual-candidate-ranking-v2")
                .threshold(new BigDecimal("0.10000"))
                .requestedLimit(20)
                .totalApplicationsScanned(0)
                .eligibleCandidates(0)
                .skippedNoCv(0)
                .skippedNotReady(0)
                .skippedTerminalStatus(0)
                .inputFingerprint("a".repeat(64))
                .jobUpdatedAtSnapshot(job.getUpdatedAt())
                .finishedAt(status == RecommendationRunStatus.PROCESSING ? null : LocalDateTime.now())
                .errorMessage(errorMessage)
                .build());
    }

    private CandidateRankingResult createRankedResult(CandidateRankingRun run, int rank, String fileName) {
        Student student = createStudent("ranked-" + run.getId() + "-" + rank + "@example.test");
        student.getUser().setFullName("Candidate " + rank);
        userRepository.saveAndFlush(student.getUser());
        CvFile cv = createCv(student, fileName, false);
        cv.setStoredFileName("secret-stored-" + rank + ".pdf");
        cv.setFilePath("secret/path/" + rank);
        cv.setFileUrl("secret/url/" + rank);
        cv.setExtractedText("private cv text");
        cv.setProcessedText("private processed text");
        cv.setAnalysisError("private analysis error");
        cvFileRepository.saveAndFlush(cv);
        JobApplication application = createApplication(student, run.getJob(), cv, ApplicationStatus.PENDING);
        return resultRepository.saveAndFlush(CandidateRankingResult.builder()
                .run(run)
                .application(application)
                .cvFile(cv)
                .score(new BigDecimal(rank == 1 ? "0.80000" : "0.90000"))
                .textScore(new BigDecimal("0.70000"))
                .skillScore(new BigDecimal("0.60000"))
                .scoringStrategy(RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID)
                .matchedSkills(List.of("spring boot", "java"))
                .missingSkills(List.of("docker"))
                .reason("Persisted reason " + rank)
                .rankPosition(rank)
                .build());
    }

    private void updateRunCreatedAt(Long runId, LocalDateTime createdAt) {
        jdbcTemplate.update(
                "UPDATE candidate_ranking_runs SET created_at = ?, started_at = ? WHERE id = ?",
                Timestamp.valueOf(createdAt),
                Timestamp.valueOf(createdAt),
                runId
        );
    }

    private String getError(String path) throws Exception {
        return mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, ownerToken()))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
    }

    private String postError(String path, String body) throws Exception {
        return mockMvc.perform(post(path).header(HttpHeaders.AUTHORIZATION, ownerToken())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound())
                .andReturn().getResponse().getContentAsString();
    }

    private String basePath(Job job) {
        return "/api/companies/me/jobs/" + job.getId() + "/candidate-ranking-runs";
    }

    private String ownerToken() {
        return bearerToken(owner.getUser());
    }

    private Set<String> fieldNames(JsonNode node) {
        java.util.HashSet<String> fields = new java.util.HashSet<>();
        node.fieldNames().forEachRemaining(fields::add);
        return Set.copyOf(fields);
    }

    private Set<String> union(Set<String> left, Set<String> right) {
        java.util.HashSet<String> values = new java.util.HashSet<>(left);
        values.addAll(right);
        return Set.copyOf(values);
    }

    private static Stream<Arguments> generationFailures() {
        return Stream.of(
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_TIMEOUT, "Private CV contents"),
                        504,
                        "AI_SERVICE_TIMEOUT",
                        "AI service request timed out"
                ),
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE, "internal upstream URL"),
                        503,
                        "AI_SERVICE_UNAVAILABLE",
                        "AI service is unavailable"
                ),
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE, "raw upstream body"),
                        502,
                        "AI_SERVICE_INVALID_RESPONSE",
                        "AI service returned an invalid response"
                ),
                Arguments.of(
                        new AiCandidateRankingCapacityException(),
                        503,
                        "CANDIDATE_RANKING_CAPACITY_EXCEEDED",
                        "Candidate ranking capacity exceeded"
                )
        );
    }
}
