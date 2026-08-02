package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.exception.AiCandidateRankingCapacityException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class CandidateRankingFailureMessageSanitizerTest {

    private final CandidateRankingFailureMessageSanitizer sanitizer =
            new CandidateRankingFailureMessageSanitizer();

    @ParameterizedTest
    @MethodSource("failures")
    void storesOnlyLockedSanitizedMessages(Throwable failure, String expectedMessage) {
        assertThat(sanitizer.sanitize(failure))
                .isEqualTo(expectedMessage)
                .doesNotContain("jdbc", "secret", "internal", "raw CV", "https://");
    }

    private static Stream<Arguments> failures() {
        return Stream.of(
                Arguments.of(
                        new AiCandidateRankingCapacityException(),
                        "Candidate ranking capacity exceeded"
                ),
                Arguments.of(
                        new AppException(ErrorCode.CANDIDATE_RANKING_CAPACITY_EXCEEDED, "secret limit 10"),
                        "Candidate ranking capacity exceeded"
                ),
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_TIMEOUT, "https://internal timeout"),
                        "AI service request timed out"
                ),
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE, "raw CV upstream body"),
                        "AI service is unavailable"
                ),
                Arguments.of(
                        new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE, "secret response"),
                        "AI service returned an invalid response"
                ),
                Arguments.of(
                        new IllegalStateException("jdbc:postgresql://secret raw CV"),
                        "Candidate ranking generation failed"
                )
        );
    }
}
