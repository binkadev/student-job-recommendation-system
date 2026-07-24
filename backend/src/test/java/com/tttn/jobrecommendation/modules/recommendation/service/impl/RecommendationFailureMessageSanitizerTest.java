package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RecommendationFailureMessageSanitizerTest {

    private final RecommendationFailureMessageSanitizer sanitizer = new RecommendationFailureMessageSanitizer();

    @Test
    void neverPersistsRawExceptionDetails() {
        String secret = "jdbc:postgresql://user:password@localhost/db C:\\private\\resume.pdf raw-cv";

        assertThat(sanitizer.sanitize(new IllegalStateException(secret)))
                .isEqualTo("Recommendation generation failed")
                .doesNotContain("password", "resume", "raw-cv");
        assertThat(sanitizer.sanitize(new AppException(ErrorCode.AI_SERVICE_TIMEOUT, secret)))
                .isEqualTo("AI service request timed out")
                .doesNotContain(secret);
    }
}
