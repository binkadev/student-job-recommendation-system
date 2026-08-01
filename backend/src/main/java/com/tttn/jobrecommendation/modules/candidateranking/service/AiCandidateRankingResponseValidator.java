package com.tttn.jobrecommendation.modules.candidateranking.service;

import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.utils.SkillNameNormalizer;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiCandidateRankingResponse;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingCandidateSnapshot;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.CandidateRankingPreparationResult;
import com.tttn.jobrecommendation.modules.candidateranking.service.model.ValidatedCandidateRankingResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

@Component
public class AiCandidateRankingResponseValidator {

    static final String EXPECTED_ALGORITHM = "tfidf-cosine-hybrid";
    static final String EXPECTED_ALGORITHM_VERSION = "bilingual-candidate-ranking-v2";
    static final int MIN_LIMIT = 1;
    static final int MAX_LIMIT = 100;
    static final int MAX_SKILLS_PER_RESULT = 100;
    static final int MAX_SKILL_LENGTH = 150;
    static final int AI_SCORE_SCALE = 8;
    static final int PERSISTENCE_SCORE_SCALE = 5;
    static final RoundingMode SCORE_ROUNDING = RoundingMode.HALF_UP;

    private static final BigDecimal TEXT_WEIGHT = new BigDecimal("0.65");
    private static final BigDecimal SKILL_WEIGHT = new BigDecimal("0.35");
    private static final BigDecimal WEIGHTED_SCORE_ALLOWANCE = new BigDecimal("0.00000001");

    public ValidatedCandidateRankingResponse validate(
            UUID expectedRequestId,
            BigDecimal requestedThreshold,
            int requestedLimit,
            CandidateRankingPreparationResult preparationResult,
            AiCandidateRankingResponse response
    ) {
        ValidationContext context = validateContext(
                expectedRequestId,
                requestedThreshold,
                requestedLimit,
                preparationResult
        );
        validateRootResponse(expectedRequestId, requestedLimit, response);

        Set<Long> seenApplicationIds = new HashSet<>();
        List<RawValidatedResult> validatedResults = new ArrayList<>(response.results().size());
        for (AiCandidateRankingResponse.Result result : response.results()) {
            validatedResults.add(validateResult(
                    result,
                    context,
                    seenApplicationIds,
                    requestedThreshold
            ));
        }

        validatedResults.sort(Comparator
                .comparing(RawValidatedResult::score)
                .reversed()
                .thenComparing(RawValidatedResult::applicationId));

        return new ValidatedCandidateRankingResponse(
                response.algorithm(),
                response.algorithmVersion(),
                toPersistenceReadyResults(validatedResults)
        );
    }

    private ValidationContext validateContext(
            UUID expectedRequestId,
            BigDecimal requestedThreshold,
            int requestedLimit,
            CandidateRankingPreparationResult preparationResult
    ) {
        if (expectedRequestId == null
                || requestedThreshold == null
                || requestedThreshold.compareTo(BigDecimal.ZERO) < 0
                || requestedThreshold.compareTo(BigDecimal.ONE) > 0
                || requestedLimit < MIN_LIMIT
                || requestedLimit > MAX_LIMIT
                || preparationResult == null
                || preparationResult.jobSnapshot() == null
                || preparationResult.jobSnapshot().canonicalSkills() == null
                || preparationResult.eligibleCandidateSnapshots() == null) {
            throw invalidResponse();
        }

        List<String> jobSkills;
        try {
            jobSkills = List.copyOf(new TreeSet<>(preparationResult.jobSnapshot().canonicalSkills()));
        } catch (RuntimeException exception) {
            throw invalidResponse();
        }

        Map<Long, CandidateRankingCandidateSnapshot> eligibleCandidates = new HashMap<>();
        for (CandidateRankingCandidateSnapshot candidate
                : preparationResult.eligibleCandidateSnapshots()) {
            if (candidate == null
                    || candidate.applicationId() == null
                    || candidate.applicationId() <= 0
                    || candidate.cvId() == null
                    || candidate.cvId() <= 0
                    || candidate.canonicalExtractedSkills() == null
                    || eligibleCandidates.putIfAbsent(candidate.applicationId(), candidate) != null) {
                throw invalidResponse();
            }
        }

        return new ValidationContext(jobSkills, Map.copyOf(eligibleCandidates));
    }

    private void validateRootResponse(
            UUID expectedRequestId,
            int requestedLimit,
            AiCandidateRankingResponse response
    ) {
        if (response == null
                || response.requestId() == null
                || !response.requestId().equals(expectedRequestId)
                || !EXPECTED_ALGORITHM.equals(response.algorithm())
                || !EXPECTED_ALGORITHM_VERSION.equals(response.algorithmVersion())
                || response.results() == null
                || response.results().size() > requestedLimit) {
            throw invalidResponse();
        }
    }

    private RawValidatedResult validateResult(
            AiCandidateRankingResponse.Result result,
            ValidationContext context,
            Set<Long> seenApplicationIds,
            BigDecimal requestedThreshold
    ) {
        if (result == null
                || result.applicationId() == null
                || result.applicationId() <= 0
                || result.cvId() == null
                || result.cvId() <= 0
                || !seenApplicationIds.add(result.applicationId())) {
            throw invalidResponse();
        }

        CandidateRankingCandidateSnapshot candidate = context.eligibleCandidates()
                .get(result.applicationId());
        if (candidate == null || !result.cvId().equals(candidate.cvId())) {
            throw invalidResponse();
        }

        BigDecimal score = validateRequiredScore(result.score());
        if (score.compareTo(requestedThreshold) < 0) {
            throw invalidResponse();
        }
        BigDecimal skillScore = validateRequiredScore(result.skillScore());
        RecommendationScoringStrategy scoringStrategy = result.scoringStrategy();
        if (scoringStrategy == null) {
            throw invalidResponse();
        }

        ValidatedSkills skills = validateSkills(
                result.matchedSkills(),
                result.missingSkills(),
                context.jobSkills(),
                candidate.canonicalExtractedSkills()
        );
        validateSkillScore(skillScore, skills.matchedSkills().size(), context.jobSkills().size());

        BigDecimal textScore = switch (scoringStrategy) {
            case SAME_LANGUAGE_HYBRID -> validateSameLanguageScores(
                    score,
                    result.textScore(),
                    skillScore,
                    context.jobSkills().isEmpty()
            );
            case CROSS_LANGUAGE_SKILL_BASED -> validateCrossLanguageScores(
                    score,
                    result.textScore(),
                    skillScore,
                    context.jobSkills().isEmpty()
            );
        };

        return new RawValidatedResult(
                result.applicationId(),
                result.cvId(),
                score,
                textScore,
                skillScore,
                scoringStrategy,
                skills.matchedSkills(),
                skills.missingSkills(),
                buildReason(scoringStrategy, context.jobSkills().size(), skills),
                candidate.processingVersion(),
                candidate.analyzedAt()
        );
    }

    private ValidatedSkills validateSkills(
            List<String> matchedSkills,
            List<String> missingSkills,
            List<String> jobSkills,
            List<String> candidateSkills
    ) {
        validateCanonicalSortedSkills(matchedSkills);
        validateCanonicalSortedSkills(missingSkills);

        Set<String> jobSkillSet = Set.copyOf(jobSkills);
        Set<String> matchedSet = Set.copyOf(matchedSkills);
        Set<String> missingSet = Set.copyOf(missingSkills);
        if (!jobSkillSet.containsAll(matchedSet)
                || !jobSkillSet.containsAll(missingSet)
                || !Collections.disjoint(matchedSet, missingSet)) {
            throw invalidResponse();
        }

        Set<String> candidateSkillSet = new HashSet<>(candidateSkills);
        List<String> expectedMatched = jobSkills.stream()
                .filter(candidateSkillSet::contains)
                .toList();
        List<String> expectedMissing = jobSkills.stream()
                .filter(skill -> !candidateSkillSet.contains(skill))
                .toList();
        if (!matchedSkills.equals(expectedMatched) || !missingSkills.equals(expectedMissing)) {
            throw invalidResponse();
        }

        return new ValidatedSkills(List.copyOf(matchedSkills), List.copyOf(missingSkills));
    }

    private void validateCanonicalSortedSkills(List<String> skills) {
        if (skills == null || skills.size() > MAX_SKILLS_PER_RESULT) {
            throw invalidResponse();
        }

        String previous = null;
        for (String skill : skills) {
            if (!StringUtils.hasText(skill)
                    || skill.length() > MAX_SKILL_LENGTH
                    || !skill.equals(SkillNameNormalizer.normalize(skill))
                    || previous != null && previous.compareTo(skill) >= 0) {
                throw invalidResponse();
            }
            previous = skill;
        }
    }

    private void validateSkillScore(BigDecimal skillScore, int matchedCount, int jobSkillCount) {
        BigDecimal expectedSkillScore = jobSkillCount == 0
                ? BigDecimal.ZERO.setScale(AI_SCORE_SCALE)
                : BigDecimal.valueOf(matchedCount)
                        .divide(BigDecimal.valueOf(jobSkillCount), AI_SCORE_SCALE, SCORE_ROUNDING);
        requireExact(skillScore, expectedSkillScore);
    }

    private BigDecimal validateSameLanguageScores(
            BigDecimal score,
            BigDecimal textScore,
            BigDecimal skillScore,
            boolean jobHasNoSkills
    ) {
        BigDecimal validatedTextScore = validateRequiredScore(textScore);
        if (jobHasNoSkills) {
            requireExact(skillScore, BigDecimal.ZERO);
            requireExact(score, validatedTextScore);
            return validatedTextScore;
        }

        BigDecimal projectedExpectedScore = TEXT_WEIGHT.multiply(validatedTextScore)
                .add(SKILL_WEIGHT.multiply(skillScore))
                .setScale(AI_SCORE_SCALE, SCORE_ROUNDING);
        if (score.subtract(projectedExpectedScore).abs()
                .compareTo(WEIGHTED_SCORE_ALLOWANCE) > 0) {
            throw invalidResponse();
        }
        return validatedTextScore;
    }

    private BigDecimal validateCrossLanguageScores(
            BigDecimal score,
            BigDecimal textScore,
            BigDecimal skillScore,
            boolean jobHasNoSkills
    ) {
        if (textScore != null) {
            throw invalidResponse();
        }
        requireExact(score, skillScore);
        if (jobHasNoSkills) {
            requireExact(skillScore, BigDecimal.ZERO);
            requireExact(score, BigDecimal.ZERO);
        }
        return null;
    }

    private BigDecimal validateRequiredScore(BigDecimal score) {
        if (score == null
                || score.compareTo(BigDecimal.ZERO) < 0
                || score.compareTo(BigDecimal.ONE) > 0) {
            throw invalidResponse();
        }
        try {
            score.setScale(AI_SCORE_SCALE, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw invalidResponse();
        }
        return score;
    }

    private void requireExact(BigDecimal actual, BigDecimal expected) {
        if (actual.compareTo(expected) != 0) {
            throw invalidResponse();
        }
    }

    private String buildReason(
            RecommendationScoringStrategy scoringStrategy,
            int jobSkillCount,
            ValidatedSkills skills
    ) {
        if (scoringStrategy == RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID) {
            if (jobSkillCount == 0) {
                return "Match score is based on the submitted CV and Job text.";
            }
            return "Matched %d of %d declared job skills: %s. Missing: %s.".formatted(
                    skills.matchedSkills().size(),
                    jobSkillCount,
                    formatSkills(skills.matchedSkills()),
                    formatSkills(skills.missingSkills())
            );
        }
        if (jobSkillCount == 0) {
            return "Cross-language match is based on canonical skill overlap.";
        }
        return "Cross-language match is based on canonical skill overlap. "
                + "Matched %d of %d: %s. Missing: %s.".formatted(
                skills.matchedSkills().size(),
                jobSkillCount,
                formatSkills(skills.matchedSkills()),
                formatSkills(skills.missingSkills())
        );
    }

    private String formatSkills(List<String> skills) {
        return skills.isEmpty() ? "none" : String.join(", ", skills);
    }

    private List<ValidatedCandidateRankingResponse.Result> toPersistenceReadyResults(
            List<RawValidatedResult> sortedResults
    ) {
        List<ValidatedCandidateRankingResponse.Result> results = new ArrayList<>(sortedResults.size());
        for (int index = 0; index < sortedResults.size(); index++) {
            RawValidatedResult result = sortedResults.get(index);
            results.add(new ValidatedCandidateRankingResponse.Result(
                    result.applicationId(),
                    result.cvId(),
                    scaleForPersistence(result.score()),
                    scaleForPersistence(result.textScore()),
                    scaleForPersistence(result.skillScore()),
                    result.scoringStrategy(),
                    result.matchedSkills(),
                    result.missingSkills(),
                    result.reason(),
                    index + 1,
                    result.cvProcessingVersion(),
                    result.cvAnalyzedAt()
            ));
        }
        return List.copyOf(results);
    }

    private BigDecimal scaleForPersistence(BigDecimal score) {
        return score == null ? null : score.setScale(PERSISTENCE_SCORE_SCALE, SCORE_ROUNDING);
    }

    private AppException invalidResponse() {
        return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }

    private record ValidationContext(
            List<String> jobSkills,
            Map<Long, CandidateRankingCandidateSnapshot> eligibleCandidates
    ) {
    }

    private record ValidatedSkills(
            List<String> matchedSkills,
            List<String> missingSkills
    ) {
    }

    private record RawValidatedResult(
            Long applicationId,
            Long cvId,
            BigDecimal score,
            BigDecimal textScore,
            BigDecimal skillScore,
            RecommendationScoringStrategy scoringStrategy,
            List<String> matchedSkills,
            List<String> missingSkills,
            String reason,
            String cvProcessingVersion,
            LocalDateTime cvAnalyzedAt
    ) {
    }
}
