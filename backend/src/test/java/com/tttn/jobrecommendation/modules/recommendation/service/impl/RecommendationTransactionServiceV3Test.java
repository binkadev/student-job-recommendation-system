package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.repository.CvFileRepository;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendationTransactionServiceV3Test {

    @Test
    void acceptsSelectedReadySnapshotWithoutExtractedTextAndPreservesV3Request() {
        Fixture fixture = fixture();
        CvFile cv = readyCv();
        cv.setExtractedText(null);
        cv.setExtractedSkills(List.of("JS", "javascript", "Spring Boot"));
        when(fixture.cvFiles.findByIdAndStudentId(11L, 7L)).thenReturn(Optional.of(cv));
        AiRecommendationV3Request.JobInput job = new AiRecommendationV3Request.JobInput(100L, "structured job", List.of("java"));
        when(fixture.v3Corpus.build(any())).thenReturn(List.of(job));

        RecommendationGenerationV3Context context = fixture.service.createProcessingRunV3(99L, request());

        assertThat(context.request().cv().id()).isEqualTo(11L);
        assertThat(context.request().cv().processedText()).isEqualTo("selected processed snapshot");
        assertThat(context.request().cv().skills()).containsExactly("javascript", "spring boot");
        assertThat(context.request().cv().languageCode()).isEqualTo("en");
        assertThat(context.request().cv().languageConfidence()).isEqualByComparingTo("0.12");
        assertThat(context.request().cv().processingVersion()).isEqualTo(RecommendationV3Contract.PROCESSING_VERSION);
        assertThat(context.request().jobs()).containsExactly(job);
        assertThat(context.jobSkillsById()).containsEntry(100L, List.of("java"));
        verify(fixture.v2Corpus, never()).build(any());
    }

    @Test
    void acceptsLowConfidenceMixedAndUnknownLanguageMetadataWithoutFallbackCvSources() {
        for (String language : List.of("mixed", "unknown")) {
            Fixture fixture = fixture();
            CvFile cv = readyCv();
            cv.setLanguageCode(language);
            cv.setLanguageConfidence(new BigDecimal("0.01"));
            when(fixture.cvFiles.findByIdAndStudentId(11L, 7L)).thenReturn(Optional.of(cv));
            when(fixture.v3Corpus.build(any())).thenReturn(List.of());

            assertThat(fixture.service.createProcessingRunV3(99L, request()).request().cv().languageCode())
                    .isEqualTo(language);
        }
    }

    @Test
    void rejectsInvalidV3ReadinessBeforeCorpusPreparation() {
        List<java.util.function.Consumer<CvFile>> invalidMutations = List.of(
                cv -> cv.setProcessedText(" "), cv -> cv.setLanguageCode(null), cv -> cv.setLanguageCode(" "),
                cv -> cv.setLanguageConfidence(null), cv -> cv.setLanguageConfidence(new BigDecimal("-0.01")),
                cv -> cv.setLanguageConfidence(new BigDecimal("1.01")), cv -> cv.setProcessingVersion("wrong"),
                cv -> cv.setAnalysisStatus(CvAnalysisStatus.FAILED)
        );
        for (java.util.function.Consumer<CvFile> mutation : invalidMutations) {
            Fixture fixture = fixture();
            CvFile cv = readyCv();
            mutation.accept(cv);
            when(fixture.cvFiles.findByIdAndStudentId(11L, 7L)).thenReturn(Optional.of(cv));
            assertThatThrownBy(() -> fixture.service.createProcessingRunV3(99L, request()))
                    .isInstanceOf(AppException.class);
            verify(fixture.v3Corpus, never()).build(any());
        }
    }

    private Fixture fixture() {
        StudentRepository students = mock(StudentRepository.class);
        CvFileRepository cvs = mock(CvFileRepository.class);
        JobRepository jobs = mock(JobRepository.class);
        RecommendationRunRepository runs = mock(RecommendationRunRepository.class);
        RecommendationResultRepository results = mock(RecommendationResultRepository.class);
        EligibleJobCorpusBuilder v2Corpus = mock(EligibleJobCorpusBuilder.class);
        EligibleJobCorpusV3Builder v3Corpus = mock(EligibleJobCorpusV3Builder.class);
        Student student = Student.builder().id(7L).build();
        when(students.findByUserId(99L)).thenReturn(Optional.of(student));
        when(runs.saveAndFlush(any())).thenAnswer(invocation -> {
            RecommendationRun run = invocation.getArgument(0);
            run.setId(55L);
            assertThat(run.getStatus()).isEqualTo(RecommendationRunStatus.PROCESSING);
            return run;
        });
        RecommendationTransactionService service = new RecommendationTransactionService(students, cvs, jobs, runs, results,
                v2Corpus, mock(AiRecommendationRequestMapper.class), v3Corpus, new AiRecommendationV3RequestMapper(),
                new SkillCatalogCanonicalizer(), mock(RecommendationFailureMessageSanitizer.class));
        return new Fixture(service, cvs, v2Corpus, v3Corpus);
    }

    private CvFile readyCv() {
        return CvFile.builder().id(11L).analysisStatus(CvAnalysisStatus.READY).processedText("selected processed snapshot")
                .extractedSkills(List.of("java")).languageCode("en").languageConfidence(new BigDecimal("0.12"))
                .processingVersion(RecommendationV3Contract.PROCESSING_VERSION).build();
    }

    private GenerateRecommendationRequest request() {
        GenerateRecommendationRequest request = new GenerateRecommendationRequest();
        request.setCvId(11L);
        request.setThreshold(new BigDecimal("0.1"));
        request.setLimit(20);
        return request;
    }

    private record Fixture(RecommendationTransactionService service, CvFileRepository cvFiles,
                           EligibleJobCorpusBuilder v2Corpus, EligibleJobCorpusV3Builder v3Corpus) {
    }
}
