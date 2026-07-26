package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiRecommendationResponseValidatorTest {

    private static final BigDecimal DEFAULT_THRESHOLD = new BigDecimal("0.1");

    private final AiRecommendationResponseValidator validator = new AiRecommendationResponseValidator();
    private final UUID requestId = UUID.randomUUID();

    @Test
    void higherScoreAlwaysGetsSmallerRankPosition() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(
                        sameLanguageResult(10L, 0.40),
                        sameLanguageResult(20L, 0.90),
                        sameLanguageResult(30L, 0.70)
                )),
                Set.of(10L, 20L, 30L),
                BigDecimal.ZERO,
                20
        );

        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::jobId)
                .containsExactly(20L, 30L, 10L);
        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::rankPosition)
                .containsExactly(1, 2, 3);
    }

    @Test
    void equalScoresUseJobIdAscendingAsDeterministicTieBreak() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(
                        sameLanguageResult(30L, 0.80),
                        sameLanguageResult(10L, 0.80),
                        sameLanguageResult(20L, 0.80)
                )),
                Set.of(10L, 20L, 30L),
                BigDecimal.ZERO,
                20
        );

        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::jobId)
                .containsExactly(10L, 20L, 30L);
    }

    @Test
    void reversedAiResultOrderProducesTheSameBackendRanking() {
        List<AiRecommendationResponse.Result> results = List.of(
                sameLanguageResult(10L, 0.70),
                sameLanguageResult(20L, 0.90),
                sameLanguageResult(30L, 0.80)
        );

        ValidatedRecommendationResponse forward = validate(
                response(results),
                Set.of(10L, 20L, 30L),
                BigDecimal.ZERO,
                20
        );
        ValidatedRecommendationResponse reversed = validate(
                response(results.reversed()),
                Set.of(10L, 20L, 30L),
                BigDecimal.ZERO,
                20
        );

        assertThat(forward.results()).isEqualTo(reversed.results());
    }

    @Test
    void backendRankPositionsAreContiguousFromOne() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(
                        sameLanguageResult(40L, 0.60),
                        sameLanguageResult(10L, 0.90),
                        sameLanguageResult(30L, 0.70),
                        sameLanguageResult(20L, 0.80)
                )),
                Set.of(10L, 20L, 30L, 40L),
                BigDecimal.ZERO,
                20
        );

        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::rankPosition)
                .containsExactly(1, 2, 3, 4);
    }

    @Test
    void lowScoreCannotAppearAboveHigherScore() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(
                        crossLanguageResult(20L, 0.10, null),
                        sameLanguageResult(30L, 0.99)
                )),
                Set.of(20L, 30L),
                BigDecimal.ZERO,
                20
        );

        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::jobId)
                .containsExactly(30L, 20L);
        assertThat(validated.results().getFirst().score().toPlainString()).isEqualTo("0.99000");
    }

    @Test
    void scoreEqualToRequestedThresholdIsAccepted() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(sameLanguageResult(10L, 0.60))),
                Set.of(10L),
                new BigDecimal("0.6"),
                20
        );

        assertThat(validated.results()).hasSize(1);
    }

    @Test
    void scoreBelowRequestedThresholdIsRejected() {
        assertInvalid(
                response(List.of(sameLanguageResult(10L, 0.59))),
                Set.of(10L),
                new BigDecimal("0.6"),
                20
        );
    }

    @Test
    void zeroThresholdAcceptsZeroScore() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(crossLanguageResult(10L, 0.0, null))),
                Set.of(10L),
                BigDecimal.ZERO,
                20
        );

        assertThat(validated.results().getFirst().score().toPlainString()).isEqualTo("0.00000");
    }

    @Test
    void thresholdOneOnlyAcceptsScoreOne() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(sameLanguageResult(10L, 1.0))),
                Set.of(10L),
                BigDecimal.ONE,
                20
        );
        assertThat(validated.results()).hasSize(1);

        assertInvalid(
                response(List.of(sameLanguageResult(10L, 0.999999))),
                Set.of(10L),
                BigDecimal.ONE,
                20
        );
    }

    @Test
    void rawScoreBelowThresholdIsRejectedBeforePersistenceRounding() {
        assertInvalid(
                response(List.of(sameLanguageResult(10L, 0.599999))),
                Set.of(10L),
                new BigDecimal("0.6"),
                20
        );
    }

    @Test
    void oneBelowThresholdResultInvalidatesTheWholeResponse() {
        assertInvalid(
                response(List.of(
                        sameLanguageResult(10L, 0.90),
                        sameLanguageResult(20L, 0.59)
                )),
                Set.of(10L, 20L),
                new BigDecimal("0.6"),
                20
        );
    }

    @Test
    void sameLanguageHybridWithNullTextScoreIsInvalid() {
        assertInvalid(
                response(List.of(result(
                        10L,
                        0.70,
                        null,
                        0.80,
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
                ))),
                Set.of(10L),
                DEFAULT_THRESHOLD,
                20
        );
    }

    @Test
    void sameLanguageHybridWithValidTextScoreIsValid() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(sameLanguageResult(10L, 0.70))),
                Set.of(10L),
                DEFAULT_THRESHOLD,
                20
        );

        assertThat(validated.results().getFirst().textScore().toPlainString()).isEqualTo("0.65000");
    }

    @Test
    void crossLanguageSkillBasedWithNullTextScoreIsValid() {
        ValidatedRecommendationResponse validated = validate(
                response(List.of(crossLanguageResult(10L, 0.70, null))),
                Set.of(10L),
                DEFAULT_THRESHOLD,
                20
        );

        assertThat(validated.results().getFirst().textScore()).isNull();
    }

    @Test
    void crossLanguageSkillBasedWithNonNullTextScoreIsInvalid() {
        assertInvalid(
                response(List.of(crossLanguageResult(10L, 0.70, 0.60))),
                Set.of(10L),
                DEFAULT_THRESHOLD,
                20
        );
    }

    @Test
    void validatesMetadataAndNormalizesAllResultFields() {
        AiRecommendationResponse.Result result = new AiRecommendationResponse.Result(
                10L,
                0.75,
                0.70,
                0.85,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                List.of(" Java ", "SPRING   BOOT", "java"),
                List.of(" Docker ", "docker"),
                "  Matched skills  "
        );

        ValidatedRecommendationResponse validated = validate(
                response(List.of(result)),
                Set.of(10L),
                DEFAULT_THRESHOLD,
                20
        );

        assertThat(validated.algorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(validated.algorithmVersion()).isEqualTo("bilingual-recommendation-v2");
        assertThat(validated.results().getFirst().matchedSkills()).containsExactly("java", "spring boot");
        assertThat(validated.results().getFirst().missingSkills()).containsExactly("docker");
        assertThat(validated.results().getFirst().reason()).isEqualTo("Matched skills");
    }

    @Test
    void rejectsInvalidIdentityMetadataJobsAndResultLimit() {
        assertInvalid(new AiRecommendationResponse(
                UUID.randomUUID(),
                "tfidf-cosine-hybrid",
                "bilingual-recommendation-v2",
                List.of(sameLanguageResult(10L, 0.5))
        ), Set.of(10L), DEFAULT_THRESHOLD, 20);
        assertInvalid(new AiRecommendationResponse(
                requestId,
                null,
                "v2",
                List.of()
        ), Set.of(), DEFAULT_THRESHOLD, 20);
        assertInvalid(new AiRecommendationResponse(
                requestId,
                "algorithm",
                " ",
                List.of()
        ), Set.of(), DEFAULT_THRESHOLD, 20);
        assertInvalid(response(List.of(sameLanguageResult(99L, 0.5))),
                Set.of(10L), DEFAULT_THRESHOLD, 20);
        assertInvalid(response(List.of(
                sameLanguageResult(10L, 0.7),
                sameLanguageResult(10L, 0.6)
        )), Set.of(10L), DEFAULT_THRESHOLD, 20);
        assertInvalid(response(List.of(
                sameLanguageResult(10L, 0.7),
                sameLanguageResult(20L, 0.6)
        )), Set.of(10L, 20L), DEFAULT_THRESHOLD, 1);
    }

    @Test
    void rejectsMissingOutOfRangeAndNonFiniteScores() {
        assertInvalidScore(-0.01, 0.5, 0.5);
        assertInvalidScore(1.01, 0.5, 0.5);
        assertInvalidScore(Double.NaN, 0.5, 0.5);
        assertInvalidScore(Double.POSITIVE_INFINITY, 0.5, 0.5);
        assertInvalidScore(null, 0.5, 0.5);
        assertInvalidScore(0.5, -0.01, 0.5);
        assertInvalidScore(0.5, Double.NaN, 0.5);
        assertInvalidScore(0.5, 0.5, 1.01);
        assertInvalidScore(0.5, 0.5, Double.NEGATIVE_INFINITY);
        assertInvalidScore(0.5, 0.5, null);
    }

    @Test
    void rejectsInvalidSkillAndReasonValues() {
        assertInvalid(response(List.of(resultWithFields(
                Arrays.asList("java", null),
                List.of(),
                "reason"
        ))), Set.of(10L), DEFAULT_THRESHOLD, 20);
        assertInvalid(response(List.of(resultWithFields(
                List.of("x".repeat(151)),
                List.of(),
                "reason"
        ))), Set.of(10L), DEFAULT_THRESHOLD, 20);
        assertInvalid(response(List.of(resultWithFields(
                Collections.nCopies(101, "java"),
                List.of(),
                "reason"
        ))), Set.of(10L), DEFAULT_THRESHOLD, 20);
        assertInvalid(response(List.of(resultWithFields(
                List.of("java"),
                List.of(),
                "x".repeat(2_001)
        ))), Set.of(10L), DEFAULT_THRESHOLD, 20);
    }

    private AiRecommendationResponse response(List<AiRecommendationResponse.Result> results) {
        return new AiRecommendationResponse(
                requestId,
                " tfidf-cosine-hybrid ",
                " bilingual-recommendation-v2 ",
                results
        );
    }

    private AiRecommendationResponse.Result sameLanguageResult(Long jobId, Double score) {
        return result(
                jobId,
                score,
                0.65,
                0.80,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
        );
    }

    private AiRecommendationResponse.Result crossLanguageResult(
            Long jobId,
            Double score,
            Double textScore
    ) {
        return result(
                jobId,
                score,
                textScore,
                0.80,
                RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
        );
    }

    private AiRecommendationResponse.Result result(
            Long jobId,
            Double score,
            Double textScore,
            Double skillScore,
            RecommendationScoringStrategy strategy
    ) {
        return new AiRecommendationResponse.Result(
                jobId,
                score,
                textScore,
                skillScore,
                strategy,
                List.of("java"),
                List.of("docker"),
                "reason"
        );
    }

    private AiRecommendationResponse.Result resultWithFields(
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason
    ) {
        return new AiRecommendationResponse.Result(
                10L,
                0.70,
                0.60,
                0.80,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                matchedSkills,
                missingSkills,
                reason
        );
    }

    private void assertInvalidScore(Double score, Double textScore, Double skillScore) {
        assertInvalid(
                response(List.of(result(
                        10L,
                        score,
                        textScore,
                        skillScore,
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
                ))),
                Set.of(10L),
                BigDecimal.ZERO,
                20
        );
    }

    private ValidatedRecommendationResponse validate(
            AiRecommendationResponse response,
            Set<Long> eligibleIds,
            BigDecimal threshold,
            int limit
    ) {
        return validator.validate(requestId, eligibleIds, threshold, limit, response);
    }

    private void assertInvalid(
            AiRecommendationResponse response,
            Set<Long> eligibleIds,
            BigDecimal threshold,
            int limit
    ) {
        assertThatThrownBy(() -> validate(response, eligibleIds, threshold, limit))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
    }
}
