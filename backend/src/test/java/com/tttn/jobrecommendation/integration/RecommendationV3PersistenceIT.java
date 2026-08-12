package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.common.enums.CompanyStatus;
import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationRunStatus;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.enums.RecommendationSourceType;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationResultRepository;
import com.tttn.jobrecommendation.modules.recommendation.repository.RecommendationRunRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationV3PersistenceIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private RecommendationRunRepository runRepository;

    @Autowired
    private RecommendationResultRepository resultRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void v3RankingFieldsPersistWithScoreMappedAsRankingScore() {
        Student student = createStudent("recommendation-v3@student.example.test");
        CvFile cvFile = createCv(student, "recommendation-v3.pdf", true);
        Company company = createCompany(
                "recommendation-v3@company.example.test",
                "Recommendation V3 Company",
                CompanyStatus.VERIFIED
        );
        Job primaryJob = createJob(company, "Primary Job", JobStatus.ACTIVE);
        Job fallbackJob = createJob(company, "Fallback Job", JobStatus.ACTIVE);
        RecommendationRun run = runRepository.saveAndFlush(RecommendationRun.builder()
                .student(student)
                .cvFile(cvFile)
                .sourceType(RecommendationSourceType.CV)
                .status(RecommendationRunStatus.SUCCESS)
                .totalJobsScanned(2)
                .build());

        resultRepository.saveAllAndFlush(List.of(
                RecommendationResult.builder()
                        .run(run)
                        .job(primaryJob)
                        .rankingScore(new BigDecimal("0.72000"))
                        .overallScore(new BigDecimal("0.72000"))
                        .textScore(new BigDecimal("0.65000"))
                        .skillScore(new BigDecimal("0.85000"))
                        .rankingTier(RecommendationRankingTier.PRIMARY)
                        .scoringStrategy(RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID)
                        .matchedKeywords(List.of("java"))
                        .missingSkills(List.of("docker"))
                        .rankPosition(1)
                        .tierRankPosition(1)
                        .build(),
                RecommendationResult.builder()
                        .run(run)
                        .job(fallbackJob)
                        .rankingScore(new BigDecimal("0.50000"))
                        .overallScore(null)
                        .textScore(null)
                        .skillScore(new BigDecimal("0.50000"))
                        .rankingTier(RecommendationRankingTier.FALLBACK)
                        .scoringStrategy(RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED)
                        .matchedKeywords(List.of("java"))
                        .missingSkills(List.of("docker"))
                        .rankPosition(2)
                        .tierRankPosition(1)
                        .build()
        ));

        entityManager.clear();

        List<RecommendationResult> reloaded = resultRepository.findByRunIdOrderByRankPositionAsc(run.getId());
        assertThat(reloaded).extracting(RecommendationResult::getRankingTier)
                .containsExactly(RecommendationRankingTier.PRIMARY, RecommendationRankingTier.FALLBACK);
        assertThat(reloaded).extracting(RecommendationResult::getRankingScore)
                .extracting(BigDecimal::toPlainString)
                .containsExactly("0.72000", "0.50000");
        assertThat(reloaded).extracting(RecommendationResult::getOverallScore)
                .containsExactly(new BigDecimal("0.72000"), null);
        assertThat(reloaded).extracting(RecommendationResult::getTierRankPosition)
                .containsExactly(1, 1);
        assertThat(reloaded.getFirst().getScore()).isEqualByComparingTo("0.72000");
    }
}
