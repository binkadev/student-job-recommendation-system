package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiRecommendationResponseValidatorTest {

    private final AiRecommendationResponseValidator validator = new AiRecommendationResponseValidator();
    private final UUID requestId = UUID.randomUUID();

    @Test
    void validatesAndRecalculatesDeterministicRanking() {
        AiRecommendationResponse response = response(List.of(
                result(30L, 0.7, 3),
                result(20L, 0.9, 1),
                result(10L, 0.7, 2)
        ));

        ValidatedRecommendationResponse validated = validator.validate(
                requestId,
                Set.of(10L, 20L, 30L),
                20,
                response
        );

        assertThat(validated.algorithmVersion()).isEqualTo("tfidf-cosine-v1");
        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::jobId)
                .containsExactly(20L, 10L, 30L);
        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::rank)
                .containsExactly(1, 2, 3);
        assertThat(validated.results().getFirst().score().toPlainString()).isEqualTo("0.90000");
    }

    @Test
    void acceptsEmptyResults() {
        ValidatedRecommendationResponse validated = validator.validate(
                requestId,
                Set.of(),
                20,
                response(List.of())
        );

        assertThat(validated.results()).isEmpty();
    }

    @Test
    void rejectsMismatchedRequestIdUnknownAndDuplicateJobs() {
        assertInvalid(new AiRecommendationResponse(
                UUID.randomUUID(),
                "tfidf-cosine-v1",
                List.of(result(10L, 0.5, 1))
        ), Set.of(10L), 20);
        assertInvalid(response(List.of(result(99L, 0.5, 1))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(10L, 0.7, 1), result(10L, 0.6, 2))), Set.of(10L), 20);
    }

    @Test
    void rejectsOutOfRangeNonFiniteAndMissingScores() {
        assertInvalid(response(List.of(result(10L, -0.01, 1))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(10L, 1.01, 1))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(10L, Double.NaN, 1))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(10L, Double.POSITIVE_INFINITY, 1))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(10L, null, 1))), Set.of(10L), 20);
    }

    @Test
    void rejectsDuplicateNonPositiveAndInconsistentRanks() {
        assertInvalid(response(List.of(result(10L, 0.7, 1), result(20L, 0.6, 1))), Set.of(10L, 20L), 20);
        assertInvalid(response(List.of(result(10L, 0.7, 0))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(10L, 0.7, 2))), Set.of(10L), 20);
    }

    @Test
    void rejectsExcessiveResultsAndInvalidSkillValues() {
        assertInvalid(response(List.of(result(10L, 0.7, 1), result(20L, 0.6, 2))), Set.of(10L, 20L), 1);
        AiRecommendationResponse.Result nullSkill = new AiRecommendationResponse.Result(
                10L,
                0.7,
                1,
                java.util.Arrays.asList("Java", null),
                List.of(),
                "reason"
        );
        assertInvalid(response(List.of(nullSkill)), Set.of(10L), 20);
        AiRecommendationResponse.Result largeSkill = new AiRecommendationResponse.Result(
                10L,
                0.7,
                1,
                List.of("x".repeat(151)),
                List.of(),
                "reason"
        );
        assertInvalid(response(List.of(largeSkill)), Set.of(10L), 20);
    }

    private AiRecommendationResponse response(List<AiRecommendationResponse.Result> results) {
        return new AiRecommendationResponse(requestId, "tfidf-cosine-v1", results);
    }

    private AiRecommendationResponse.Result result(Long jobId, Double score, Integer rank) {
        return new AiRecommendationResponse.Result(
                jobId,
                score,
                rank,
                List.of("Java"),
                List.of("PostgreSQL"),
                "Matched skills"
        );
    }

    private void assertInvalid(AiRecommendationResponse response, Set<Long> eligibleIds, int limit) {
        assertThatThrownBy(() -> validator.validate(requestId, eligibleIds, limit, response))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
    }
}
