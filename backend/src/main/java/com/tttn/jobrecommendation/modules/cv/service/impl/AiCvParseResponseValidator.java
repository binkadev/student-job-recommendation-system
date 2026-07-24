package com.tttn.jobrecommendation.modules.cv.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCvParseResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@Component
public class AiCvParseResponseValidator {

    static final int MAX_TEXT_LENGTH = 1_000_000;
    static final int MAX_SKILLS = 200;
    static final int MAX_SKILL_LENGTH = 150;

    public AiCvParseResponse validate(AiCvParseResponse response) {
        if (response == null
                || !StringUtils.hasText(response.processedText())
                || response.processedText().length() > MAX_TEXT_LENGTH
                || response.rawText() != null && response.rawText().length() > MAX_TEXT_LENGTH
                || response.skills() == null
                || response.skills().size() > MAX_SKILLS) {
            throw invalidResponse();
        }

        List<String> normalizedSkills = response.skills().stream()
                .map(this::normalizeSkill)
                .distinct()
                .sorted()
                .toList();

        return new AiCvParseResponse(
                trimToNull(response.rawText()),
                response.processedText().strip(),
                normalizedSkills
        );
    }

    private String normalizeSkill(String skill) {
        if (!StringUtils.hasText(skill) || skill.length() > MAX_SKILL_LENGTH) {
            throw invalidResponse();
        }
        return SkillNameNormalizer.normalize(skill);
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
