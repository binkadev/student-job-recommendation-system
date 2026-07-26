package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.SkillLevel;
import com.tttn.jobrecommendation.common.enums.SkillSource;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.skill.entity.Skill;
import com.tttn.jobrecommendation.modules.skill.entity.StudentSkill;
import com.tttn.jobrecommendation.modules.skill.repository.SkillRepository;
import com.tttn.jobrecommendation.modules.skill.repository.StudentSkillRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CvReanalysisStateIT extends AbstractPostgresWebIntegrationTest {

    @MockitoBean
    private AiServiceClient aiServiceClient;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private StudentSkillRepository studentSkillRepository;

    @Test
    void processingIsCommittedAndAiCallRunsOutsideTransactionBeforeFullSuccessIsPersisted() throws Exception {
        Student student = createStudent("cv-state-success@example.test");
        CvFile selectedCv = readyCv(student, "selected-success.pdf", true, List.of("legacy"));
        CvFile siblingCv = readyCv(student, "sibling-success.pdf", false, List.of("python"));
        writeCvFile(selectedCv, "%PDF-success".getBytes(StandardCharsets.UTF_8));
        StudentSkill manualSkill = addStudentSkill(student, "Docker");

        AtomicBoolean transactionActiveAtParse = new AtomicBoolean(true);
        AtomicReference<String> committedStatusAtParse = new AtomicReference<>();
        when(aiServiceClient.parseCv(any(), anyString(), any(MediaType.class))).thenAnswer(invocation -> {
            transactionActiveAtParse.set(TransactionSynchronizationManager.isActualTransactionActive());
            committedStatusAtParse.set(jdbcTemplate.queryForObject(
                    "SELECT analysis_status FROM cv_files WHERE id = ?",
                    String.class,
                    selectedCv.getId()
            ));
            return new AiCvParseResponse(
                    "Raw bilingual CV",
                    "processed bilingual cv",
                    List.of(" Spring  Boot ", "JAVA", "java"),
                    " VI ",
                    0.875d,
                    " bilingual-nlp-v2 ",
                    List.of(" First warning ", "Second warning")
            );
        });

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", selectedCv.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.skills[0]").value("java"))
                .andExpect(jsonPath("$.data.skills[1]").value("spring boot"))
                .andExpect(jsonPath("$.data.languageCode").value("vi"))
                .andExpect(jsonPath("$.data.processingVersion").value("bilingual-nlp-v2"))
                .andExpect(jsonPath("$.data.warnings[0]").value("First warning"));

        assertThat(transactionActiveAtParse.get()).isFalse();
        assertThat(committedStatusAtParse.get()).isEqualTo("PROCESSING");

        CvFile analyzed = cvFileRepository.findById(selectedCv.getId()).orElseThrow();
        assertThat(analyzed.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.READY);
        assertThat(analyzed.getExtractedText()).isEqualTo("Raw bilingual CV");
        assertThat(analyzed.getProcessedText()).isEqualTo("processed bilingual cv");
        assertThat(analyzed.getExtractedSkills()).containsExactly("java", "spring boot");
        assertThat(analyzed.getLanguageCode()).isEqualTo("vi");
        assertThat(analyzed.getLanguageConfidence()).isEqualByComparingTo("0.875");
        assertThat(analyzed.getProcessingVersion()).isEqualTo("bilingual-nlp-v2");
        assertThat(analyzed.getAnalysisWarnings()).containsExactly("First warning", "Second warning");
        assertThat(analyzed.getAnalyzedAt()).isNotNull();
        assertThat(analyzed.getAnalysisError()).isNull();

        assertThat(cvFileRepository.findById(siblingCv.getId()).orElseThrow().getExtractedSkills())
                .containsExactly("python");
        assertThat(studentSkillRepository.findByStudentIdOrderByIdAsc(student.getId()))
                .extracting(StudentSkill::getId)
                .containsExactly(manualSkill.getId());
    }

    @ParameterizedTest
    @MethodSource("parseFailures")
    void parseFailuresAlwaysPersistSanitizedFailedState(
            RuntimeException failure,
            int expectedHttpStatus,
            String expectedErrorCode,
            String expectedAnalysisError
    ) throws Exception {
        Student student = createStudent("cv-state-failure-" + expectedErrorCode.toLowerCase() + "@example.test");
        CvFile cvFile = readyCv(student, expectedErrorCode.toLowerCase() + ".pdf", true, List.of("legacy"));
        writeCvFile(cvFile, "%PDF-failure".getBytes(StandardCharsets.UTF_8));
        when(aiServiceClient.parseCv(any(), anyString(), any(MediaType.class))).thenThrow(failure);

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().is(expectedHttpStatus))
                .andExpect(jsonPath("$.errorCode").value(expectedErrorCode));

        assertFailedAndReset(cvFile.getId(), expectedAnalysisError);
    }

    @Test
    void fileLoadFailureAfterProcessingIsPersistedAsFailedWithoutCallingAi() throws Exception {
        Student student = createStudent("cv-state-load-failure@example.test");
        CvFile cvFile = readyCv(student, "missing-source.pdf", true, List.of("legacy"));

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(student.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

        verifyNoInteractions(aiServiceClient);
        assertFailedAndReset(cvFile.getId(), "CV source file is unavailable");
    }

    @Test
    void foreignStudentCannotStartReanalysisOrDiscoverCvOwnership() throws Exception {
        Student owner = createStudent("cv-state-owner@example.test");
        Student other = createStudent("cv-state-other@example.test");
        CvFile cvFile = readyCv(owner, "foreign-owner.pdf", true, List.of("java"));
        writeCvFile(cvFile, "%PDF-owner".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(post("/api/students/me/cv/{cvId}/reanalyze", cvFile.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearerToken(other.getUser())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));

        verifyNoInteractions(aiServiceClient);
        CvFile unchanged = cvFileRepository.findById(cvFile.getId()).orElseThrow();
        assertThat(unchanged.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.READY);
        assertThat(unchanged.getExtractedSkills()).containsExactly("java");
    }

    private static Stream<Arguments> parseFailures() {
        return Stream.of(
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_TIMEOUT),
                        504,
                        "AI_SERVICE_TIMEOUT",
                        "AI service request timed out"
                ),
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE),
                        503,
                        "AI_SERVICE_UNAVAILABLE",
                        "AI service is unavailable"
                ),
                Arguments.of(
                        new IllegalStateException("secret C:\\private\\resume.pdf and internal response"),
                        502,
                        "CV_ANALYSIS_FAILED",
                        "CV analysis failed"
                )
        );
    }

    private CvFile readyCv(
            Student student,
            String fileName,
            boolean active,
            List<String> extractedSkills
    ) {
        CvFile cvFile = createCv(student, fileName, active);
        cvFile.setExtractedText("legacy raw text");
        cvFile.setProcessedText("legacy processed text");
        cvFile.setExtractedSkills(extractedSkills);
        cvFile.setAnalysisStatus(CvAnalysisStatus.READY);
        cvFile.setAnalysisError("legacy error");
        cvFile.setLanguageCode("en");
        cvFile.setLanguageConfidence(new BigDecimal("0.9900"));
        cvFile.setProcessingVersion("legacy-v1");
        cvFile.setAnalysisWarnings(List.of("legacy warning"));
        cvFile.setAnalyzedAt(LocalDateTime.now().minusDays(1));
        return cvFileRepository.saveAndFlush(cvFile);
    }

    private StudentSkill addStudentSkill(Student student, String name) {
        Skill skill = skillRepository.saveAndFlush(Skill.builder()
                .name(name)
                .normalizedName(name.toLowerCase())
                .build());
        return studentSkillRepository.saveAndFlush(StudentSkill.builder()
                .student(student)
                .skill(skill)
                .level(SkillLevel.INTERMEDIATE)
                .source(SkillSource.MANUAL)
                .build());
    }

    private void assertFailedAndReset(Long cvId, String expectedAnalysisError) {
        CvFile failed = cvFileRepository.findById(cvId).orElseThrow();
        assertThat(failed.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.FAILED);
        assertThat(failed.getExtractedText()).isEqualTo("legacy raw text");
        assertThat(failed.getProcessedText()).isNull();
        assertThat(failed.getExtractedSkills()).isEmpty();
        assertThat(failed.getLanguageCode()).isNull();
        assertThat(failed.getLanguageConfidence()).isNull();
        assertThat(failed.getProcessingVersion()).isNull();
        assertThat(failed.getAnalysisWarnings()).isEmpty();
        assertThat(failed.getAnalyzedAt()).isNull();
        assertThat(failed.getAnalysisError())
                .isEqualTo(expectedAnalysisError)
                .doesNotContain("secret", "private", "resume.pdf", "internal response");
    }
}
