package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiCvParseResponseValidatorTest {

    private final AiCvParseResponseValidator validator = new AiCvParseResponseValidator();

    @Test
    void trimsTextAndNormalizesSkills() {
        AiCvParseResponse validated = validator.validate(new AiCvParseResponse(
                " raw text ",
                " java spring ",
                List.of(" Spring  Boot ", "JAVA", "java")
        ));

        assertThat(validated.rawText()).isEqualTo("raw text");
        assertThat(validated.processedText()).isEqualTo("java spring");
        assertThat(validated.skills()).containsExactly("java", "spring boot");
    }

    @Test
    void rejectsMalformedParseResponses() {
        assertInvalid(null);
        assertInvalid(new AiCvParseResponse("raw", " ", List.of()));
        assertInvalid(new AiCvParseResponse("raw", "processed", null));
        assertInvalid(new AiCvParseResponse("raw", "processed", Arrays.asList("Java", null)));
        assertInvalid(new AiCvParseResponse("raw", "processed", List.of("x".repeat(151))));
    }

    private void assertInvalid(AiCvParseResponse response) {
        assertThatThrownBy(() -> validator.validate(response))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
    }
}
