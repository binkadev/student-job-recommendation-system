package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.CvAnalysisStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationGenerationService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendationPersistenceFailureIT extends AbstractPostgresIntegrationTest {

    private static final String SENSITIVE_FAILURE =
            "jdbc:postgresql://user:secret@internal/recommendation raw AI response";

    @MockitoBean
    private AiServiceClient aiServiceClient;

    @MockitoSpyBean
    private RecommendationResultRepository recommendationResultRepository;

    @Autowired
    private RecommendationGenerationService recommendationGenerationService;

    @Autowired
    private RecommendationRunRepository recommendationRunRepository;

    @Test
    void resultFlushFailureRollsBackAllResultsAndMarksRunFailedInNewTransaction() {
        Student student = createStudent("recommendation-persistence-failure@example.test");
        CvFile cvFile = createCv(student, "persistence-failure.pdf", true);
        cvFile.setExtractedText("Java backend engineer");
        cvFile.setProcessedText("java backend engineer");
        cvFile.setExtractedSkills(List.of("java"));
        cvFile.setAnalysisStatus(CvAnalysisStatus.READY);
        cvFile.setLanguageCode("en");
        cvFile.setLanguageConfidence(new java.math.BigDecimal("0.99"));
        cvFile.setProcessingVersion("bilingual-nlp-v2-skills-v1");
        cvFileRepository.saveAndFlush(cvFile);

        Company company = createCompany(
                "recommendation-persistence-company@example.test",
                "Persistence Failure Company",
                CompanyStatus.VERIFIED
        );
        Job firstJob = createJob(company, "First eligible job", JobStatus.ACTIVE);
        Job secondJob = createJob(company, "Second eligible job", JobStatus.ACTIVE);

        when(aiServiceClient.recommendV3(any(AiRecommendationV3Request.class)))
                .thenAnswer(invocation -> {
                    AiRecommendationV3Request request = invocation.getArgument(0);
                    AiRecommendationV3Response response = new AiRecommendationV3Response(
                            request.requestId(),
                            "tfidf-cosine-hybrid",
                            "bilingual-recommendation-v3",
                            List.of(
                                    result(firstJob.getId(), request.jobs().get(0).skills()),
                                    result(secondJob.getId(), request.jobs().get(1).skills())
                            )
                    );
                    return response;
                });

        doAnswer(invocation -> {
            invocation.callRealMethod();
            throw new DataIntegrityViolationException(SENSITIVE_FAILURE);
        }).when(recommendationResultRepository).saveAllAndFlush(anyList());

        GenerateRecommendationRequest request = new GenerateRecommendationRequest();
        request.setCvId(cvFile.getId());

        assertThatThrownBy(() -> recommendationGenerationService.generate(student.getUser().getId(), request))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.RECOMMENDATION_GENERATION_FAILED));

        verify(recommendationResultRepository).saveAllAndFlush(anyList());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM recommendation_results",
                Long.class
        )).isZero();

        RecommendationRun failedRun = recommendationRunRepository.findAll().getFirst();
        assertThat(failedRun.getStatus()).isEqualTo(RecommendationRunStatus.FAILED);
        assertThat(failedRun.getFinishedAt()).isNotNull();
        assertThat(failedRun.getErrorMessage())
                .isEqualTo("Recommendation generation failed")
                .doesNotContain("jdbc", "secret", "internal", "raw AI response");
    }

    private AiRecommendationV3Response.Result result(Long jobId, List<String> jobSkills) {
        List<String> cvSkills = List.of("java");
        List<String> matched = jobSkills.stream().filter(cvSkills::contains).toList();
        List<String> missing = jobSkills.stream().filter(skill -> !cvSkills.contains(skill)).toList();
        java.math.BigDecimal skillScore = jobSkills.isEmpty() ? java.math.BigDecimal.ZERO.setScale(8)
                : java.math.BigDecimal.valueOf(matched.size())
                        .divide(java.math.BigDecimal.valueOf(jobSkills.size()), 8, java.math.RoundingMode.HALF_UP);
        java.math.BigDecimal textScore = new java.math.BigDecimal("0.33333333");
        java.math.BigDecimal overallScore = jobSkills.isEmpty() ? textScore
                : textScore.multiply(new java.math.BigDecimal("0.65"))
                        .add(skillScore.multiply(new java.math.BigDecimal("0.35")))
                        .setScale(8, java.math.RoundingMode.HALF_UP);
        return new AiRecommendationV3Response.Result(
                jobId,
                RecommendationRankingTier.PRIMARY,
                overallScore,
                overallScore,
                textScore,
                skillScore,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                matched,
                missing,
                "Strong Java overlap"
        );
    }
}
