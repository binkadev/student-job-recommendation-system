package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiRecommendationV3ResponseValidatorTest {

    private final UUID requestId = UUID.randomUUID();
    private final AiRecommendationV3ResponseValidator validator =
            new AiRecommendationV3ResponseValidator(new SkillCatalogCanonicalizer());

    @Test
    void validatesEvidenceFormulaAndOfficialTierOrdering() {
        AiRecommendationV3Response response = response(List.of(
                fallback(40L, "1.00000000", List.of("java", "spring boot"), List.of()),
                primary(30L, "0.61000000", "0.40000000", "1.00000000"),
                primary(20L, "0.61000000", "0.40000000", "1.00000000"),
                fallback(10L, "0.50000000", List.of("java"), List.of("docker"))
        ));

        ValidatedRecommendationV3Response validated = validator.validate(
                requestId, List.of("java", "spring boot"),
                Map.of(10L, List.of("docker", "java"), 20L, List.of("java", "spring boot"),
                        30L, List.of("java", "spring boot"), 40L, List.of("java", "spring boot")),
                BigDecimal.ZERO, 20, response
        );

        assertThat(validated.results()).extracting(ValidatedRecommendationV3Response.Result::jobId)
                .containsExactly(20L, 30L, 40L, 10L);
        assertThat(validated.results()).extracting(ValidatedRecommendationV3Response.Result::rankPosition)
                .containsExactly(1, 2, 3, 4);
        assertThat(validated.results()).extracting(ValidatedRecommendationV3Response.Result::tierRankPosition)
                .containsExactly(1, 2, 1, 2);
        assertThat(validated.results().get(2).overallScore()).isNull();
        assertThat(validated.results().get(2).rankingScore()).isEqualByComparingTo("1.00000");
    }

    @Test
    void rejectsRootIdentityCountThresholdAndScoreAttacks() {
        assertInvalid(new AiRecommendationV3Response(UUID.randomUUID(), RecommendationV3Contract.ALGORITHM,
                RecommendationV3Contract.ALGORITHM_VERSION, List.of()));
        assertInvalid(new AiRecommendationV3Response(requestId, "wrong", RecommendationV3Contract.ALGORITHM_VERSION, List.of()));
        assertInvalid(new AiRecommendationV3Response(requestId, RecommendationV3Contract.ALGORITHM, "wrong", List.of()));
        assertInvalid(new AiRecommendationV3Response(requestId, RecommendationV3Contract.ALGORITHM,
                RecommendationV3Contract.ALGORITHM_VERSION, null));
        assertInvalid(response(List.of(primary(99L, "0.61000000", "0.40000000", "1.00000000"))));
        assertInvalid(response(List.of(primary(10L, "0.610000000", "0.40000000", "1.00000000"))));
        assertInvalid(response(List.of(primary(10L, "0.09000000", "0.40000000", "1.00000000"))), new BigDecimal("0.1"));
    }

    @Test
    void rejectsTierAndFormulaMismatches() {
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000000"), decimal("0.61000000"), decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.FALLBACK,
                decimal("1.00000000"), null, null, decimal("1.00000000"), RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(primary(10L, "0.62000000", "0.40000000", "0.80000000"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.FALLBACK,
                decimal("0.50000000"), decimal("0.50000000"), null, decimal("0.50000000"),
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of("java"), List.of("spring boot"), "reason"))));
    }

    @Test
    void rejectsNoncanonicalUnsortedOrWrongEvidenceAndAcceptsZeroFallbackAtZeroThreshold() {
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("spring boot", "java"), List.of()))));
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("Java"), List.of("spring boot")))));
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("java"), List.of()))));
        AiRecommendationV3Response zero = new AiRecommendationV3Response(requestId, RecommendationV3Contract.ALGORITHM,
                RecommendationV3Contract.ALGORITHM_VERSION, List.of(new AiRecommendationV3Response.Result(
                50L, RecommendationRankingTier.FALLBACK, decimal("0.00000000"), null, null, decimal("0.00000000"),
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of(), List.of(), "reason")));
        assertThat(validator.validate(requestId, List.of("java"), Map.of(50L, List.of()), BigDecimal.ZERO, 20, zero).results())
                .hasSize(1);
    }

    @Test
    void rejectsIdentityScoreTierReasonAndEvidenceAttackCases() {
        assertInvalid(response(List.of(primary(10L, "0.61000000", "0.40000000", "1.00000000"),
                primary(10L, "0.61000000", "0.40000000", "1.00000000"))));
        assertInvalid(response(List.of(primary(10L, "-0.01000000", "0.40000000", "1.00000000"))));
        assertInvalid(response(List.of(primary(10L, "1.01000000", "0.40000000", "1.00000000"))));
        assertInvalid(response(List.of(primary(10L, "0.61000000", "0.40000000", "-0.01000000"))));
        assertInvalid(response(List.of(primary(10L, "0.61000000", "0.40000000", "1.01000000"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, null, decimal("0.61000000"),
                decimal("0.61000000"), decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000000"), null, decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000000"), decimal("0.61000000"), null, decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000000"), decimal("0.61000000"), decimal("0.40000000"), decimal("1.00000000"),
                null, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.60000000"), decimal("0.61000000"), decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.FALLBACK,
                decimal("1.00000000"), null, decimal("0.1"), decimal("1.00000000"),
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.FALLBACK,
                decimal("1.00000000"), decimal("1.00000000"), null, decimal("1.00000000"),
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.FALLBACK,
                decimal("0.90000000"), null, null, decimal("1.00000000"),
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, List.of("java", "spring boot"), List.of(), "reason"))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000000"), decimal("0.61000000"), decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), " "))));
        assertInvalid(response(List.of(new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000000"), decimal("0.61000000"), decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), "x".repeat(2001)))));
    }

    @Test
    void enforcesExactTextOnlyPrimaryAndLimitedHybridAllowance() {
        AiRecommendationV3Response.Result textOnly = new AiRecommendationV3Response.Result(50L,
                RecommendationRankingTier.PRIMARY, decimal("0.33333333"), decimal("0.33333333"),
                decimal("0.33333333"), decimal("0.00000000"), RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                List.of(), List.of(), "reason");
        assertThat(validator.validate(requestId, List.of("java"), Map.of(50L, List.of()), BigDecimal.ZERO, 20,
                response(List.of(textOnly))).results()).hasSize(1);
        assertInvalidForJob(50L, List.of(), new AiRecommendationV3Response.Result(50L, RecommendationRankingTier.PRIMARY,
                decimal("0.33333334"), decimal("0.33333334"), decimal("0.33333333"), decimal("0.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), List.of(), "reason"));
        assertInvalidForJob(50L, List.of(), new AiRecommendationV3Response.Result(50L, RecommendationRankingTier.PRIMARY,
                decimal("0.33333333"), decimal("0.33333334"), decimal("0.33333333"), decimal("0.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), List.of(), "reason"));
        assertInvalidForJob(50L, List.of(), new AiRecommendationV3Response.Result(50L, RecommendationRankingTier.PRIMARY,
                decimal("0.33333333"), decimal("0.33333333"), decimal("0.33333333"), decimal("0.10000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of(), List.of(), "reason"));
        AiRecommendationV3Response.Result allowance = new AiRecommendationV3Response.Result(10L, RecommendationRankingTier.PRIMARY,
                decimal("0.61000001"), decimal("0.61000001"), decimal("0.40000000"), decimal("1.00000000"),
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, List.of("java", "spring boot"), List.of(), "reason");
        assertThat(validator.validate(requestId, List.of("java", "spring boot"), Map.of(10L, List.of("java", "spring boot")),
                BigDecimal.ZERO, 20, response(List.of(allowance))).results()).hasSize(1);
        assertInvalid(response(List.of(primary(10L, "0.61000002", "0.40000000", "1.00000000"))));
    }

    @Test
    void enforcesLimitThresholdAndDetailedEvidenceRequirements() {
        assertInvalid(response(List.of(primary(10L, "0.61000000", "0.40000000", "1.00000000"),
                primary(10L, "0.61000000", "0.40000000", "1.00000000"))));
        assertThat(validator.validate(requestId, List.of("java", "spring boot"), Map.of(10L, List.of("java", "spring boot")),
                new BigDecimal("0.61"), 1, response(List.of(primary(10L, "0.61000000", "0.40000000", "1.00000000")))).results()).hasSize(1);
        assertInvalid(response(List.of(primary(10L, "0.61000000", "0.40000000", "1.00000000"),
                primary(20L, "0.61000000", "0.40000000", "1.00000000"))), BigDecimal.ZERO, 1);
        assertInvalid(response(List.of(fallback(10L, "0.00000000", List.of(), List.of("java", "spring boot")))), new BigDecimal("0.1"));
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("java", "java"), List.of()))));
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("spring boot"), List.of("java")))));
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("Java"), List.of("spring boot")))));
        assertInvalid(response(List.of(fallback(10L, "0.50000000", List.of("java"), List.of()))));
        assertInvalid(response(List.of(fallback(10L, "1.00000000", List.of("java", "spring boot"), List.of("docker")))));
    }

    private AiRecommendationV3Response response(List<AiRecommendationV3Response.Result> results) {
        return new AiRecommendationV3Response(requestId, RecommendationV3Contract.ALGORITHM,
                RecommendationV3Contract.ALGORITHM_VERSION, results);
    }

    private AiRecommendationV3Response.Result primary(Long id, String overall, String text, String skill) {
        return new AiRecommendationV3Response.Result(id, RecommendationRankingTier.PRIMARY, decimal(overall), decimal(overall),
                decimal(text), decimal(skill), RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                List.of("java", "spring boot"), List.of(), "reason");
    }

    private AiRecommendationV3Response.Result fallback(Long id, String score, List<String> matched, List<String> missing) {
        return new AiRecommendationV3Response.Result(id, RecommendationRankingTier.FALLBACK, decimal(score), null, null,
                decimal(score), RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, matched, missing, "reason");
    }

    private BigDecimal decimal(String value) {
        return new BigDecimal(value);
    }

    private void assertInvalid(AiRecommendationV3Response response) {
        assertInvalid(response, BigDecimal.ZERO);
    }

    private void assertInvalid(AiRecommendationV3Response response, BigDecimal threshold) {
        assertThatThrownBy(() -> validator.validate(requestId, List.of("java", "spring boot"),
                Map.of(10L, List.of("java", "spring boot")), threshold, 20, response))
                .isInstanceOfSatisfying(AppException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
    }

    private void assertInvalid(AiRecommendationV3Response response, BigDecimal threshold, int limit) {
        assertThatThrownBy(() -> validator.validate(requestId, List.of("java", "spring boot"),
                Map.of(10L, List.of("java", "spring boot"), 20L, List.of("java", "spring boot")), threshold, limit, response))
                .isInstanceOf(AppException.class);
    }

    private void assertInvalidForJob(Long jobId, List<String> skills, AiRecommendationV3Response.Result result) {
        assertThatThrownBy(() -> validator.validate(requestId, List.of("java"), Map.of(jobId, skills), BigDecimal.ZERO, 20,
                response(List.of(result)))).isInstanceOf(AppException.class);
    }
}
