package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class AiRecommendationResponseValidator {

    static final int MAX_ALGORITHM_LENGTH = 100;
    static final int MAX_ALGORITHM_VERSION_LENGTH = 100;
    static final int MAX_SKILLS_PER_RESULT = 100;
    static final int MAX_SKILL_LENGTH = 150;
    static final int MAX_REASON_LENGTH = 2_000;

    public ValidatedRecommendationResponse validate(
            UUID expectedRequestId,
            Set<Long> eligibleJobIds,
            BigDecimal requestedThreshold,
            int requestedLimit,
            AiRecommendationResponse response
    ) {
        if (response == null
                || response.requestId() == null
                || !response.requestId().equals(expectedRequestId)
                || eligibleJobIds == null
                || requestedThreshold == null
                || requestedThreshold.compareTo(BigDecimal.ZERO) < 0
                || requestedThreshold.compareTo(BigDecimal.ONE) > 0
                || requestedLimit <= 0
                || response.results() == null
                || response.results().size() > requestedLimit) {
            throw invalidResponse();
        }

        String algorithm = normalizeRequiredMetadata(response.algorithm(), MAX_ALGORITHM_LENGTH);
        String algorithmVersion = normalizeRequiredMetadata(
                response.algorithmVersion(),
                MAX_ALGORITHM_VERSION_LENGTH
        );
        Set<Long> seenJobIds = new HashSet<>();
        List<ValidatedResult> validated = new ArrayList<>();
        for (AiRecommendationResponse.Result result : response.results()) {
            validated.add(validateResult(
                    result,
                    eligibleJobIds,
                    seenJobIds,
                    requestedThreshold
            ));
        }
        validated.sort(Comparator
                .comparing(ValidatedResult::score)
                .reversed()
                .thenComparing(ValidatedResult::jobId));

        return new ValidatedRecommendationResponse(
                algorithm,
                algorithmVersion,
                toRankedResults(validated)
        );
    }

    private ValidatedResult validateResult(
            AiRecommendationResponse.Result result,
            Set<Long> eligibleJobIds,
            Set<Long> seenJobIds,
            BigDecimal requestedThreshold
    ) {
        if (result == null
                || result.jobId() == null
                || !eligibleJobIds.contains(result.jobId())
                || !seenJobIds.add(result.jobId())
                || result.scoringStrategy() == null
                || result.matchedSkills() == null
                || result.missingSkills() == null
                || result.matchedSkills().size() > MAX_SKILLS_PER_RESULT
                || result.missingSkills().size() > MAX_SKILLS_PER_RESULT
                || result.reason() != null && result.reason().length() > MAX_REASON_LENGTH) {
            throw invalidResponse();
        }

        BigDecimal score = validateRequiredRawScore(result.score());
        if (score.compareTo(requestedThreshold) < 0) {
            throw invalidResponse();
        }
        BigDecimal textScore = switch (result.scoringStrategy()) {
            case SAME_LANGUAGE_HYBRID -> validateRequiredRawScore(result.textScore());
            case CROSS_LANGUAGE_SKILL_BASED -> {
                if (result.textScore() != null) {
                    throw invalidResponse();
                }
                yield null;
            }
        };
        BigDecimal skillScore = validateRequiredRawScore(result.skillScore());

        return new ValidatedResult(
                result.jobId(),
                score,
                textScore,
                skillScore,
                result.scoringStrategy(),
                normalizeSkills(result.matchedSkills()),
                normalizeSkills(result.missingSkills()),
                normalizeReason(result.reason())
        );
    }

    private List<ValidatedRecommendationResponse.Result> toRankedResults(
            List<ValidatedResult> validated
    ) {
        List<ValidatedRecommendationResponse.Result> ranked = new ArrayList<>(validated.size());
        for (int index = 0; index < validated.size(); index++) {
            ValidatedResult result = validated.get(index);
            ranked.add(new ValidatedRecommendationResponse.Result(
                    result.jobId(),
                    scaleForPersistence(result.score()),
                    scaleForPersistence(result.textScore()),
                    scaleForPersistence(result.skillScore()),
                    result.scoringStrategy(),
                    index + 1,
                    result.matchedSkills(),
                    result.missingSkills(),
                    result.reason()
            ));
        }
        return List.copyOf(ranked);
    }

    private List<String> normalizeSkills(List<String> skills) {
        return skills.stream()
                .map(this::validateAndNormalizeSkill)
                .distinct()
                .sorted()
                .toList();
    }

    private String validateAndNormalizeSkill(String skill) {
        if (!StringUtils.hasText(skill) || skill.length() > MAX_SKILL_LENGTH) {
            throw invalidResponse();
        }
        return SkillNameNormalizer.normalize(skill);
    }

    private BigDecimal validateRequiredRawScore(Double score) {
        if (score == null) {
            throw invalidResponse();
        }
        if (!Double.isFinite(score) || score < 0.0d || score > 1.0d) {
            throw invalidResponse();
        }
        return BigDecimal.valueOf(score);
    }

    private BigDecimal scaleForPersistence(BigDecimal score) {
        return score == null ? null : score.setScale(5, RoundingMode.HALF_UP);
    }

    private String normalizeRequiredMetadata(String value, int maxLength) {
        if (!StringUtils.hasText(value) || value.length() > maxLength) {
            throw invalidResponse();
        }
        return value.strip();
    }

    private String normalizeReason(String reason) {
        return reason == null ? null : reason.strip();
    }

    private AppException invalidResponse() {
        return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }

    private record ValidatedResult(
            Long jobId,
            BigDecimal score,
            BigDecimal textScore,
            BigDecimal skillScore,
            RecommendationScoringStrategy scoringStrategy,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason
    ) {
    }
}
