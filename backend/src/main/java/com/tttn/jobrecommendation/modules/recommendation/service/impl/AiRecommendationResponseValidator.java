package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
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
                || !StringUtils.hasText(response.algorithmVersion())
                || response.algorithmVersion().length() > MAX_ALGORITHM_VERSION_LENGTH
                || response.results() == null
                || response.results().size() > requestedLimit) {
            throw invalidResponse();
        }

        Set<Long> seenJobIds = new HashSet<>();
        Set<Integer> seenRanks = new HashSet<>();
        List<AiRecommendationResponse.Result> validated = new ArrayList<>();
        for (AiRecommendationResponse.Result result : response.results()) {
            validateResult(result, eligibleJobIds, seenJobIds, seenRanks);
            validated.add(result);
        }
        for (int expectedRank = 1; expectedRank <= validated.size(); expectedRank++) {
            if (!seenRanks.contains(expectedRank)) {
                throw invalidResponse();
            }
        }

        validated.sort(Comparator
                .comparing(AiRecommendationResponse.Result::score, Comparator.reverseOrder())
                .thenComparing(AiRecommendationResponse.Result::jobId));

        List<ValidatedRecommendationResponse.Result> deterministicResults = new ArrayList<>();
        for (int index = 0; index < validated.size(); index++) {
            AiRecommendationResponse.Result result = validated.get(index);
            deterministicResults.add(new ValidatedRecommendationResponse.Result(
                    result.jobId(),
                    BigDecimal.valueOf(result.score()).setScale(5, RoundingMode.HALF_UP),
                    index + 1,
                    normalizeSkills(result.matchedSkills())
            ));
        }

        return new ValidatedRecommendationResponse(
                response.algorithmVersion().strip(),
                List.copyOf(deterministicResults)
        );
    }

    private void validateResult(
            AiRecommendationResponse.Result result,
            Set<Long> eligibleJobIds,
            Set<Long> seenJobIds,
            Set<Integer> seenRanks
    ) {
        if (result == null
                || result.jobId() == null
                || !eligibleJobIds.contains(result.jobId())
                || !seenJobIds.add(result.jobId())
                || result.score() == null
                || !Double.isFinite(result.score())
                || result.score() < 0.0d
                || result.score() > 1.0d
                || result.rank() == null
                || result.rank() <= 0
                || !seenRanks.add(result.rank())
                || result.matchedSkills() == null
                || result.missingSkills() == null
                || result.matchedSkills().size() > MAX_SKILLS_PER_RESULT
                || result.missingSkills().size() > MAX_SKILLS_PER_RESULT
                || result.reason() != null && result.reason().length() > MAX_REASON_LENGTH) {
            throw invalidResponse();
        }
        validateSkills(result.matchedSkills());
        validateSkills(result.missingSkills());
    }

    private List<String> normalizeSkills(List<String> skills) {
        return skills.stream()
                .map(String::strip)
                .distinct()
                .sorted()
                .toList();
    }

    private void validateSkills(List<String> skills) {
        for (String skill : skills) {
            if (!StringUtils.hasText(skill) || skill.length() > MAX_SKILL_LENGTH) {
                throw invalidResponse();
            }
        }
    }

    private AppException invalidResponse() {
        return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }
}
