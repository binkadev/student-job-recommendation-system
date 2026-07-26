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
            int requestedLimit,
            AiRecommendationResponse response
    ) {
        if (response == null
                || response.requestId() == null
                || !response.requestId().equals(expectedRequestId)
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
        Set<Integer> seenRanks = new HashSet<>();
        List<ValidatedRecommendationResponse.Result> validated = new ArrayList<>();
        for (AiRecommendationResponse.Result result : response.results()) {
            validated.add(validateResult(result, eligibleJobIds, seenJobIds, seenRanks));
        }
        for (int expectedRank = 1; expectedRank <= validated.size(); expectedRank++) {
            if (!seenRanks.contains(expectedRank)) {
                throw invalidResponse();
            }
        }

        validated.sort(Comparator.comparing(ValidatedRecommendationResponse.Result::rank));

        return new ValidatedRecommendationResponse(
                algorithm,
                algorithmVersion,
                List.copyOf(validated)
        );
    }

    private ValidatedRecommendationResponse.Result validateResult(
            AiRecommendationResponse.Result result,
            Set<Long> eligibleJobIds,
            Set<Long> seenJobIds,
            Set<Integer> seenRanks
    ) {
        if (result == null
                || result.jobId() == null
                || !eligibleJobIds.contains(result.jobId())
                || !seenJobIds.add(result.jobId())
                || result.rank() == null
                || result.rank() <= 0
                || !seenRanks.add(result.rank())
                || result.scoringStrategy() == null
                || result.matchedSkills() == null
                || result.missingSkills() == null
                || result.matchedSkills().size() > MAX_SKILLS_PER_RESULT
                || result.missingSkills().size() > MAX_SKILLS_PER_RESULT
                || result.reason() != null && result.reason().length() > MAX_REASON_LENGTH) {
            throw invalidResponse();
        }

        BigDecimal score = validateScore(result.score(), true);
        BigDecimal textScore = validateScore(result.textScore(), false);
        BigDecimal skillScore = validateScore(result.skillScore(), true);
        if (result.scoringStrategy() == RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
                && textScore == null) {
            throw invalidResponse();
        }

        return new ValidatedRecommendationResponse.Result(
                result.jobId(),
                score,
                textScore,
                skillScore,
                result.scoringStrategy(),
                result.rank(),
                normalizeSkills(result.matchedSkills()),
                normalizeSkills(result.missingSkills()),
                normalizeReason(result.reason())
        );
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

    private BigDecimal validateScore(Double score, boolean required) {
        if (score == null) {
            if (required) {
                throw invalidResponse();
            }
            return null;
        }
        if (!Double.isFinite(score) || score < 0.0d || score > 1.0d) {
            throw invalidResponse();
        }
        return BigDecimal.valueOf(score).setScale(5, RoundingMode.HALF_UP);
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
}
