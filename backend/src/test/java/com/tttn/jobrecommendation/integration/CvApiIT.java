package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.ApplicationStatus;
import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingResult;
import com.tttn.jobrecommendation.modules.candidateranking.entity.CandidateRankingRun;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingResultRepository;
import com.tttn.jobrecommendation.modules.candidateranking.repository.CandidateRankingRunRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CvApiIT extends AbstractPostgresWebIntegrationTest {

    private static final byte[] CV_CONTENTS = "%PDF-student-cv".getBytes(StandardCharsets.UTF_8);

    @Autowired
    private RecommendationRunRepository recommendationRunRepository;

    @Autowired
    private CandidateRankingRunRepository candidateRankingRunRepository;

    @Autowired
    private CandidateRankingResultRepository candidateRankingResultRepository;

    @Test
    void uploadInitializesCvAnalysisStateAsNotReady() throws Exception {
        Student owner = createStudent("cv-upload-owner@example.test");
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "resume.pdf",
                "application/pdf",
                CV_CONTENTS
        );

        mockMvc.perform(multipart("/api/students/me/cv")
                        .file(file)
                        .param("active", "true")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.extractedText").value(nullValue()))
                .andExpect(jsonPath("$.data.processedText").value(nullValue()));

        CvFile uploaded = cvFileRepository.findAll().getFirst();
        assertThat(uploaded.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.NOT_READY);
        assertThat(uploaded.getExtractedText()).isNull();
        assertThat(uploaded.getProcessedText()).isNull();
        assertThat(uploaded.getExtractedSkills()).isEmpty();
        assertThat(uploaded.getAnalysisError()).isNull();
        assertThat(uploaded.getLanguageCode()).isNull();
        assertThat(uploaded.getLanguageConfidence()).isNull();
        assertThat(uploaded.getProcessingVersion()).isNull();
        assertThat(uploaded.getAnalysisWarnings()).isEmpty();
        assertThat(uploaded.getAnalyzedAt()).isNull();
    }

    @Test
    void ownerCanStreamCvInlineByDefaultAndAsAttachment() throws Exception {
        Student owner = createStudent("cv-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "owner-stored.pdf", "owner-resume.pdf", false);

        MvcResult inlineResult = mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CV_CONTENTS))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/pdf"))
                .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, CV_CONTENTS.length))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("inline;")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("owner-resume.pdf")))
                .andReturn();

        String inlineHeaders = inlineResult.getResponse().getHeaderNames().stream()
                .flatMap(name -> inlineResult.getResponse().getHeaders(name).stream())
                .reduce("", (left, right) -> left + " " + right);
        assertThat(inlineHeaders)
                .doesNotContain(cvFile.getStoredFileName())
                .doesNotContain(CV_STORAGE_DIRECTORY.toString());

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .param("download", "true")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CV_CONTENTS))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, startsWith("attachment;")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("owner-resume.pdf")));
    }

    @Test
    void anotherStudentGetsSameNotFoundResponseAsAnAbsentCv() throws Exception {
        Student owner = createStudent("private-cv-owner@example.test");
        Student anotherStudent = createStudent("private-cv-reader@example.test");
        CvFile cvFile = createStoredCv(owner, "private-stored.pdf", "private-resume.pdf", false);

        MvcResult nonOwnedResult = mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        MvcResult absentResult = mockMvc.perform(get("/api/students/me/cv/{cvId}/file", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        assertThat(nonOwnedResult.getResponse().getContentAsString())
                .isEqualTo(absentResult.getResponse().getContentAsString());
    }

    @Test
    void missingPhysicalCvFileReturnsNotFound() throws Exception {
        Student owner = createStudent("missing-file-owner@example.test");
        CvFile cvFile = createCv(owner, "missing-stored.pdf", false);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void unsafeStoredPathCannotEscapeConfiguredStorageDirectory() throws Exception {
        Student owner = createStudent("unsafe-path-owner@example.test");
        String outsideFileName = "outside-" + UUID.randomUUID() + ".pdf";
        Path outsideFile = CV_STORAGE_DIRECTORY.getParent().resolve(outsideFileName);
        Files.write(outsideFile, "outside contents".getBytes(StandardCharsets.UTF_8));

        try {
            CvFile cvFile = createCv(owner, "../" + outsideFileName, false);
            mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                            .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

            assertThat(Files.readString(outsideFile)).isEqualTo("outside contents");
        } finally {
            Files.deleteIfExists(outsideFile);
        }
    }

    @Test
    void malformedDownloadFlagIsRejectedAsBadRequest() throws Exception {
        Student owner = createStudent("bad-download-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "bad-download-stored.pdf", "resume.pdf", false);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .param("download", "not-a-boolean")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"));
    }

    @Test
    void nonStudentCannotAccessStudentCvFileOrDeleteRoutes() throws Exception {
        Student owner = createStudent("role-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "role-stored.pdf", "role-resume.pdf", false);
        var company = createCompany(
                "role-company@example.test",
                "Role Company",
                CompanyStatus.VERIFIED
        );
        var admin = createUser("role-admin@example.test", UserRole.ADMIN);

        mockMvc.perform(get("/api/students/me/cv/{cvId}/file", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(company.getUser())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(admin)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void ownerCanDeleteUnusedCvMetadataAndPhysicalFile() throws Exception {
        Student owner = createStudent("delete-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "delete-stored.pdf", "delete-resume.pdf", false);
        Path physicalFile = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName());

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("CV deleted successfully"))
                .andExpect(jsonPath("$.data").value(nullValue()));

        assertThat(cvFileRepository.existsById(cvFile.getId())).isFalse();
        assertThat(Files.exists(physicalFile)).isFalse();
    }

    @Test
    void nonOwnerCannotDeleteCvAndMetadataAndPhysicalFileArePreserved() throws Exception {
        Student owner = createStudent("protected-delete-owner@example.test");
        Student anotherStudent = createStudent("protected-delete-attacker@example.test");
        CvFile cvFile = createStoredCv(owner, "protected-stored.pdf", "protected-resume.pdf", false);
        Path physicalFile = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName());

        MvcResult nonOwnedResult = mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        MvcResult absentResult = mockMvc.perform(delete("/api/students/me/cv/{cvId}", Long.MAX_VALUE)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(anotherStudent.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andReturn();

        assertThat(nonOwnedResult.getResponse().getContentAsString())
                .isEqualTo(absentResult.getResponse().getContentAsString());

        assertThat(cvFileRepository.existsById(cvFile.getId())).isTrue();
        assertThat(Files.exists(physicalFile)).isTrue();
    }

    @Test
    void referencedCvCannotBeDeletedAndMetadataAndPhysicalFileArePreserved() throws Exception {
        Student owner = createStudent("referenced-cv-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "referenced-stored.pdf", "referenced-resume.pdf", false);
        Path physicalFile = CV_STORAGE_DIRECTORY.resolve(cvFile.getStoredFileName());
        Job job = createJob(
                createCompany("referenced-company@example.test", "Referenced Company", CompanyStatus.VERIFIED),
                "Referenced CV Job",
                JobStatus.ACTIVE
        );
        JobApplication application = createApplication(owner, job, cvFile, ApplicationStatus.PENDING);

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("CV_IN_USE"));

        assertThat(cvFileRepository.existsById(cvFile.getId())).isTrue();
        assertThat(jobApplicationRepository.existsById(application.getId())).isTrue();
        assertThat(Files.exists(physicalFile)).isTrue();
    }

    @Test
    void cvResponsesExposeActualDeletabilityRatherThanInferringItFromActiveState() throws Exception {
        Student owner = createStudent("cv-deletability-owner@example.test");
        CvFile activeUnusedCv = createStoredCv(owner, "active-unused.pdf", "active-unused.pdf", true);
        CvFile inactiveReferencedCv = createStoredCv(owner, "inactive-referenced.pdf", "inactive-referenced.pdf", false);
        Job job = createJob(
                createCompany("cv-deletability-company@example.test", "CV Deletability", CompanyStatus.VERIFIED),
                "CV Deletability Job",
                JobStatus.ACTIVE
        );
        createApplication(owner, job, inactiveReferencedCv, ApplicationStatus.REJECTED);

        mockMvc.perform(get("/api/students/me/cv")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %s)].isActive", activeUnusedCv.getId()).value(contains(true)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].deletable", activeUnusedCv.getId()).value(contains(true)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].deleteBlockedReason", activeUnusedCv.getId()).value(contains(nullValue())))
                .andExpect(jsonPath("$.data[?(@.id == %s)].isActive", inactiveReferencedCv.getId()).value(contains(false)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].deletable", inactiveReferencedCv.getId()).value(contains(false)))
                .andExpect(jsonPath("$.data[?(@.id == %s)].deleteBlockedReason", inactiveReferencedCv.getId()).value(contains("IN_USE")));
    }

    @Test
    void recommendationRunOnlyReferenceBlocksCvDeletion() throws Exception {
        Student owner = createStudent("recommendation-run-cv-owner@example.test");
        CvFile cvFile = createStoredCv(owner, "recommendation-run-only.pdf", "recommendation-run-only.pdf", false);
        recommendationRunRepository.saveAndFlush(RecommendationRun.builder()
                .student(owner)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.SUCCESS)
                .totalJobsScanned(0)
                .finishedAt(LocalDateTime.now())
                .build());

        assertCvIsReportedAndRejectedAsInUse(owner, cvFile);
        assertThat(cvFileRepository.existsById(cvFile.getId())).isTrue();
    }

    @Test
    void candidateRankingResultOnlyReferenceBlocksCvDeletion() throws Exception {
        Student owner = createStudent("candidate-result-cv-owner@example.test");
        CvFile resultCv = createStoredCv(owner, "candidate-result-only.pdf", "candidate-result-only.pdf", false);
        Company company = createCompany("candidate-result-company@example.test", "Candidate Result Company", CompanyStatus.VERIFIED);
        Job job = createJob(company, "Candidate Result Job", JobStatus.ACTIVE);
        CvFile submittedCv = createStoredCv(owner, "candidate-submitted.pdf", "candidate-submitted.pdf", false);
        JobApplication application = createApplication(owner, job, submittedCv, ApplicationStatus.PENDING);
        CandidateRankingRun run = candidateRankingRunRepository.saveAndFlush(CandidateRankingRun.builder()
                .job(job)
                .requestId(UUID.randomUUID())
                .status(RecommendationRunStatus.SUCCESS)
                .algorithm("tfidf-cosine-hybrid")
                .algorithmVersion("bilingual-candidate-ranking-v2")
                .threshold(new BigDecimal("0.10000"))
                .requestedLimit(1)
                .totalApplicationsScanned(1)
                .eligibleCandidates(1)
                .skippedNoCv(0)
                .skippedNotReady(0)
                .skippedTerminalStatus(0)
                .inputFingerprint("a".repeat(64))
                .jobUpdatedAtSnapshot(job.getUpdatedAt())
                .build());
        candidateRankingResultRepository.saveAndFlush(CandidateRankingResult.builder()
                .run(run)
                .application(application)
                .cvFile(resultCv)
                .score(new BigDecimal("0.72000"))
                .textScore(new BigDecimal("0.65000"))
                .skillScore(new BigDecimal("0.85000"))
                .scoringStrategy(RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID)
                .matchedSkills(List.of())
                .missingSkills(List.of())
                .rankPosition(1)
                .build());

        assertCvIsReportedAndRejectedAsInUse(owner, resultCv);
        assertThat(cvFileRepository.existsById(resultCv.getId())).isTrue();
        assertThat(jobApplicationRepository.findById(application.getId()).orElseThrow().getCvFile().getId())
                .isEqualTo(submittedCv.getId());
    }

    @Test
    void deletingActiveUnusedCvDoesNotActivateAnotherCv() throws Exception {
        Student owner = createStudent("active-delete-owner@example.test");
        CvFile inactiveCv = createStoredCv(owner, "inactive-stored.pdf", "inactive-resume.pdf", false);
        CvFile activeCv = createStoredCv(owner, "active-stored.pdf", "active-resume.pdf", true);

        mockMvc.perform(delete("/api/students/me/cv/{cvId}", activeCv.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(cvFileRepository.existsById(activeCv.getId())).isFalse();
        assertThat(cvFileRepository.findFirstByStudentIdAndActiveTrueOrderByUploadedAtDesc(owner.getId())).isEmpty();
        assertThat(cvFileRepository.findById(inactiveCv.getId()).orElseThrow().isActive()).isFalse();
    }

    private CvFile createStoredCv(
            Student student,
            String storedFileName,
            String originalFileName,
            boolean active
    ) throws Exception {
        CvFile cvFile = createCv(student, storedFileName, active);
        cvFile.setFileName(originalFileName);
        cvFile.setOriginalFileName(originalFileName);
        cvFile = cvFileRepository.saveAndFlush(cvFile);
        writeCvFile(cvFile, CV_CONTENTS);
        return cvFile;
    }

    private void assertCvIsReportedAndRejectedAsInUse(Student owner, CvFile cvFile) throws Exception {
        mockMvc.perform(get("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deletable").value(false))
                .andExpect(jsonPath("$.data.deleteBlockedReason").value("IN_USE"));
        mockMvc.perform(delete("/api/students/me/cv/{cvId}", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(owner.getUser())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("CV_IN_USE"));
    }
}
