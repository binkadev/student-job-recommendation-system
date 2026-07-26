package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiRecommendationResponseValidatorTest {

    private final AiRecommendationResponseValidator validator = new AiRecommendationResponseValidator();
    private final UUID requestId = UUID.randomUUID();

    @Test
    void validatesFullResponsePreservesAiRanksAndNormalizesFields() {
        AiRecommendationResponse response = response(List.of(
                result(30L, 0.99, 0.80, 0.70, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 3),
                result(20L, 0.10, null, 0.90, RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED, 1),
                result(10L, 0.80, 0.75, 0.85, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 2)
        ));

        ValidatedRecommendationResponse validated = validator.validate(
                requestId,
                Set.of(10L, 20L, 30L),
                20,
                response
        );

        assertThat(validated.algorithm()).isEqualTo("tfidf-cosine-hybrid");
        assertThat(validated.algorithmVersion()).isEqualTo("bilingual-recommendation-v2");
        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::jobId)
                .containsExactly(20L, 10L, 30L);
        assertThat(validated.results())
                .extracting(ValidatedRecommendationResponse.Result::rank)
                .containsExactly(1, 2, 3);
        assertThat(validated.results().getFirst().score().toPlainString()).isEqualTo("0.10000");
        assertThat(validated.results().getFirst().textScore()).isNull();
        assertThat(validated.results().getFirst().skillScore().toPlainString()).isEqualTo("0.90000");
        assertThat(validated.results().getFirst().scoringStrategy())
                .isEqualTo(RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED);
        assertThat(validated.results().getFirst().matchedSkills()).containsExactly("java", "spring boot");
        assertThat(validated.results().getFirst().missingSkills()).containsExactly("docker");
        assertThat(validated.results().getFirst().reason()).isEqualTo("Matched skills");
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
    void rejectsMissingMetadataMismatchedRequestIdUnknownAndDuplicateJobs() {
        assertInvalid(new AiRecommendationResponse(
                UUID.randomUUID(),
                "tfidf-cosine-hybrid",
                "bilingual-recommendation-v2",
                List.of(result(
                        10L,
                        0.5,
                        0.4,
                        0.6,
                        RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                        1
                ))
        ), Set.of(10L), 20);
        assertInvalid(new AiRecommendationResponse(requestId, null, "v2", List.of()), Set.of(), 20);
        assertInvalid(new AiRecommendationResponse(requestId, "algorithm", " ", List.of()), Set.of(), 20);
        assertInvalid(response(List.of(result(
                99L,
                0.5,
                0.4,
                0.6,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(
                result(10L, 0.7, 0.6, 0.8, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1),
                result(10L, 0.6, 0.5, 0.7, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 2)
        )), Set.of(10L), 20);
    }

    @Test
    void rejectsOutOfRangeNonFiniteAndMissingScores() {
        assertInvalid(response(List.of(result(
                10L, -0.01, 0.5, 0.5, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, 1.01, 0.5, 0.5, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, Double.NaN, 0.5, 0.5, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, Double.POSITIVE_INFINITY, 0.5, 0.5,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, null, 0.5, 0.5, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
    }

    @Test
    void validatesComponentScoresAndStrategyRules() {
        assertInvalid(response(List.of(result(
                10L, 0.5, -0.01, 0.5, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, 0.5, 0.5, 1.01, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, 0.5, 0.5, null, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, 0.5, null, 0.5, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1
        ))), Set.of(10L), 20);

        ValidatedRecommendationResponse crossLanguage = validator.validate(
                requestId,
                Set.of(10L),
                20,
                response(List.of(result(
                        10L,
                        0.5,
                        null,
                        0.5,
                        RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED,
                        1
                )))
        );
        assertThat(crossLanguage.results().getFirst().textScore()).isNull();
    }

    @Test
    void rejectsDuplicateNonPositiveAndInconsistentRanks() {
        assertInvalid(response(List.of(
                result(10L, 0.7, 0.6, 0.8, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1),
                result(20L, 0.6, 0.5, 0.7, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1)
        )), Set.of(10L, 20L), 20);
        assertInvalid(response(List.of(result(
                10L, 0.7, 0.6, 0.8, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 0
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(result(
                10L, 0.7, 0.6, 0.8, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 2
        ))), Set.of(10L), 20);
    }

    @Test
    void rejectsExcessiveResultsAndInvalidSkillValues() {
        assertInvalid(response(List.of(
                result(10L, 0.7, 0.6, 0.8, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 1),
                result(20L, 0.6, 0.5, 0.7, RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID, 2)
        )), Set.of(10L, 20L), 1);

        assertInvalid(response(List.of(resultWithSkills(
                List.of("java"),
                java.util.Arrays.asList("docker", null)
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(resultWithSkills(
                List.of("x".repeat(151)),
                List.of()
        ))), Set.of(10L), 20);
        assertInvalid(response(List.of(resultWithSkills(
                Collections.nCopies(101, "java"),
                List.of()
        ))), Set.of(10L), 20);
    }

    private AiRecommendationResponse response(List<AiRecommendationResponse.Result> results) {
        return new AiRecommendationResponse(
                requestId,
                " tfidf-cosine-hybrid ",
                " bilingual-recommendation-v2 ",
                results
        );
    }

    private AiRecommendationResponse.Result result(
            Long jobId,
            Double score,
            Double textScore,
            Double skillScore,
            RecommendationScoringStrategy strategy,
            Integer rank
    ) {
        return new AiRecommendationResponse.Result(
                jobId,
                score,
                textScore,
                skillScore,
                strategy,
                rank,
                List.of(" Java ", "SPRING   BOOT", "java"),
                List.of(" Docker ", "docker"),
                "  Matched skills  "
        );
    }

    private AiRecommendationResponse.Result resultWithSkills(
            List<String> matchedSkills,
            List<String> missingSkills
    ) {
        return new AiRecommendationResponse.Result(
                10L,
                0.7,
                0.6,
                0.8,
                RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID,
                1,
                matchedSkills,
                missingSkills,
                "reason"
        );
    }

    private void assertInvalid(AiRecommendationResponse response, Set<Long> eligibleIds, int limit) {
        assertThatThrownBy(() -> validator.validate(requestId, eligibleIds, limit, response))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
    }
}
