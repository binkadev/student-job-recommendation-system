package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiCvParseResponseValidatorTest {

    private final AiCvParseResponseValidator validator = new AiCvParseResponseValidator();

    @Test
    void rejectsNullRawText() {
        assertInvalid(responseWithRawText(null));
    }

    @Test
    void rejectsBlankRawText() {
        assertInvalid(responseWithRawText(" \t\r\n "));
    }

    @Test
    void trimsAndKeepsValidRawText() {
        AiCvParseResponse validated = validator.validate(responseWithRawText("  Raw CV text  "));

        assertThat(validated.rawText()).isEqualTo("Raw CV text");
    }

    @Test
    void normalizesAndKeepsEveryV2Field() {
        AiCvParseResponse validated = validator.validate(new AiCvParseResponse(
                " raw text ",
                " java spring ",
                List.of(" Spring  Boot ", "JAVA", "java"),
                " EN ",
                0.98d,
                " bilingual-nlp-v2 ",
                List.of(" First warning ", "Second warning")
        ));

        assertThat(validated.rawText()).isEqualTo("raw text");
        assertThat(validated.processedText()).isEqualTo("java spring");
        assertThat(validated.skills()).containsExactly("java", "spring boot");
        assertThat(validated.languageCode()).isEqualTo("en");
        assertThat(validated.languageConfidence()).isEqualTo(0.98d);
        assertThat(validated.processingVersion()).isEqualTo("bilingual-nlp-v2");
        assertThat(validated.warnings()).containsExactly("First warning", "Second warning");
    }

    @Test
    void rejectsMissingOrInvalidRequiredFields() {
        assertInvalid(null);
        assertInvalid(validResponse(" ", List.of("java"), "en", 0.5d, "v2", List.of()));
        assertInvalid(validResponse("processed", null, "en", 0.5d, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), null, 0.5d, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "fr", 0.5d, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", null, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", Double.NaN, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", Double.POSITIVE_INFINITY, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", -0.01d, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", 1.01d, "v2", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", 0.5d, " ", List.of()));
        assertInvalid(validResponse("processed", List.of("java"), "en", 0.5d, "v2", null));
    }

    @Test
    void rejectsNullBlankAndOverLimitCollectionEntries() {
        assertInvalid(validResponse(
                "processed",
                Arrays.asList("Java", null),
                "en",
                0.5d,
                "v2",
                List.of()
        ));
        assertInvalid(validResponse("processed", List.of(" "), "en", 0.5d, "v2", List.of()));
        assertInvalid(validResponse(
                "processed",
                List.of("x".repeat(AiCvParseResponseValidator.MAX_SKILL_LENGTH + 1)),
                "en",
                0.5d,
                "v2",
                List.of()
        ));
        assertInvalid(validResponse("processed", List.of("java"), "en", 0.5d, "v2", List.of(" ")));
        assertInvalid(validResponse(
                "processed",
                List.of("java"),
                "en",
                0.5d,
                "v2",
                List.of("x".repeat(AiCvParseResponseValidator.MAX_WARNING_LENGTH + 1))
        ));
    }

    @Test
    void rejectsOverLimitTextsMetadataAndCollectionCounts() {
        assertInvalid(new AiCvParseResponse(
                "x".repeat(AiCvParseResponseValidator.MAX_TEXT_LENGTH + 1),
                "processed",
                List.of("java"),
                "en",
                0.5d,
                "v2",
                List.of()
        ));
        assertInvalid(validResponse(
                "x".repeat(AiCvParseResponseValidator.MAX_TEXT_LENGTH + 1),
                List.of("java"),
                "en",
                0.5d,
                "v2",
                List.of()
        ));
        assertInvalid(validResponse(
                "processed",
                Collections.nCopies(AiCvParseResponseValidator.MAX_SKILLS + 1, "java"),
                "en",
                0.5d,
                "v2",
                List.of()
        ));
        assertInvalid(validResponse(
                "processed",
                List.of("java"),
                "e".repeat(AiCvParseResponseValidator.MAX_LANGUAGE_CODE_LENGTH + 1),
                0.5d,
                "v2",
                List.of()
        ));
        assertInvalid(validResponse(
                "processed",
                List.of("java"),
                "en",
                0.5d,
                "v".repeat(AiCvParseResponseValidator.MAX_PROCESSING_VERSION_LENGTH + 1),
                List.of()
        ));
        assertInvalid(validResponse(
                "processed",
                List.of("java"),
                "en",
                0.5d,
                "v2",
                Collections.nCopies(AiCvParseResponseValidator.MAX_WARNINGS + 1, "warning")
        ));
    }

    private AiCvParseResponse validResponse(
            String processedText,
            List<String> skills,
            String languageCode,
            Double languageConfidence,
            String processingVersion,
            List<String> warnings
    ) {
        return new AiCvParseResponse(
                "raw",
                processedText,
                skills,
                languageCode,
                languageConfidence,
                processingVersion,
                warnings
        );
    }

    private AiCvParseResponse responseWithRawText(String rawText) {
        return new AiCvParseResponse(
                rawText,
                "processed",
                List.of("java"),
                "en",
                0.5d,
                "v2",
                List.of()
        );
    }

    private void assertInvalid(AiCvParseResponse response) {
        assertThatThrownBy(() -> validator.validate(response))
                .isInstanceOfSatisfying(AppException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AI_SERVICE_INVALID_RESPONSE));
    }
}
