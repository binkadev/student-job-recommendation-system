package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class AiCvParseResponseValidator {

    static final int MAX_TEXT_LENGTH = 1_000_000;
    static final int MAX_SKILLS = 200;
    static final int MAX_SKILL_LENGTH = 150;
    static final int MAX_LANGUAGE_CODE_LENGTH = 20;
    static final int MAX_PROCESSING_VERSION_LENGTH = 100;
    static final int MAX_WARNINGS = 100;
    static final int MAX_WARNING_LENGTH = 2_000;

    private static final Set<String> SUPPORTED_LANGUAGE_CODES = Set.of(
            "en",
            "vi",
            "mixed",
            "unknown"
    );

    public AiCvParseResponse validate(AiCvParseResponse response) {
        if (response == null) {
            throw invalidResponse();
        }

        String rawText = trimToNull(response.rawText());
        if (response.rawText() != null && response.rawText().length() > MAX_TEXT_LENGTH) {
            throw invalidResponse();
        }

        String processedText = requireTrimmedText(response.processedText(), MAX_TEXT_LENGTH);

        if (response.skills() == null || response.skills().size() > MAX_SKILLS) {
            throw invalidResponse();
        }
        List<String> normalizedSkills = response.skills()
                .stream()
                .map(this::normalizeSkill)
                .distinct()
                .sorted()
                .toList();

        String languageCode = requireTrimmedText(
                response.languageCode(),
                MAX_LANGUAGE_CODE_LENGTH
        ).toLowerCase(Locale.ROOT);
        if (!SUPPORTED_LANGUAGE_CODES.contains(languageCode)) {
            throw invalidResponse();
        }

        Double languageConfidence = response.languageConfidence();
        if (languageConfidence == null
                || !Double.isFinite(languageConfidence)
                || languageConfidence < 0.0d
                || languageConfidence > 1.0d) {
            throw invalidResponse();
        }

        String processingVersion = requireTrimmedText(
                response.processingVersion(),
                MAX_PROCESSING_VERSION_LENGTH
        );

        if (response.warnings() == null || response.warnings().size() > MAX_WARNINGS) {
            throw invalidResponse();
        }
        List<String> warnings = response.warnings()
                .stream()
                .map(this::normalizeWarning)
                .toList();

        return new AiCvParseResponse(
                rawText,
                processedText,
                normalizedSkills,
                languageCode,
                languageConfidence,
                processingVersion,
                warnings
        );
    }

    private String normalizeSkill(String skill) {
        if (!StringUtils.hasText(skill) || skill.length() > MAX_SKILL_LENGTH) {
            throw invalidResponse();
        }
        return SkillNameNormalizer.normalize(skill);
    }

    private String normalizeWarning(String warning) {
        return requireTrimmedText(warning, MAX_WARNING_LENGTH);
    }

    private String requireTrimmedText(String value, int maxLength) {
        if (!StringUtils.hasText(value) || value.length() > maxLength) {
            throw invalidResponse();
        }
        String trimmed = value.strip();
        return trimmed;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.strip();
    }

    private AppException invalidResponse() {
        return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }
}
