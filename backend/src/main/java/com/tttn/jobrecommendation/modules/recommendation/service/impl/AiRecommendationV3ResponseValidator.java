package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.enums.RecommendationRankingTier;
import com.tttn.jobrecommendation.common.enums.RecommendationScoringStrategy;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
import com.tttn.jobrecommendation.infrastructure.ai.skill.SkillCatalogCanonicalizer;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
class AiRecommendationV3ResponseValidator {

    private static final int AI_SCORE_SCALE = 8;
    private static final int PERSISTENCE_SCORE_SCALE = 5;
    private static final int MAX_SKILLS = 100;
    private static final int MAX_SKILL_LENGTH = 150;
    private static final int MAX_REASON_LENGTH = 2_000;
    private static final BigDecimal TEXT_WEIGHT = new BigDecimal("0.65");
    private static final BigDecimal SKILL_WEIGHT = new BigDecimal("0.35");
    private static final BigDecimal FORMULA_ALLOWANCE = new BigDecimal("0.00000001");

    private final SkillCatalogCanonicalizer canonicalizer;

    AiRecommendationV3ResponseValidator(SkillCatalogCanonicalizer canonicalizer) {
        this.canonicalizer = canonicalizer;
    }

    ValidatedRecommendationV3Response validate(
            UUID requestId,
            List<String> cvSkills,
            Map<Long, List<String>> jobSkillsById,
            BigDecimal threshold,
            int limit,
            AiRecommendationV3Response response
    ) {
        if (requestId == null || cvSkills == null || jobSkillsById == null || threshold == null
                || threshold.compareTo(BigDecimal.ZERO) < 0 || threshold.compareTo(BigDecimal.ONE) > 0
                || limit < 1 || limit > 100 || response == null || !requestId.equals(response.requestId())
                || !RecommendationV3Contract.ALGORITHM.equals(response.algorithm())
                || !RecommendationV3Contract.ALGORITHM_VERSION.equals(response.algorithmVersion())
                || response.results() == null || response.results().size() > limit) {
            throw invalid();
        }
        Map<Long, List<String>> jobs = normalizedJobs(jobSkillsById);
        Set<String> cvSkillSet = new HashSet<>(cvSkills);
        Set<Long> seen = new HashSet<>();
        List<RawResult> results = new ArrayList<>();
        for (AiRecommendationV3Response.Result result : response.results()) {
            results.add(validateResult(result, jobs, cvSkillSet, seen, threshold));
        }
        results.sort(Comparator.comparing(RawResult::rankingTier)
                .thenComparing(RawResult::rankingScore, Comparator.reverseOrder())
                .thenComparing(RawResult::jobId));
        // Enum order PRIMARY/FALLBACK is intentional and part of the public V3 contract.
        List<ValidatedRecommendationV3Response.Result> ranked = new ArrayList<>();
        int primaryRank = 0;
        int fallbackRank = 0;
        for (int index = 0; index < results.size(); index++) {
            RawResult result = results.get(index);
            int tierRank = result.rankingTier() == RecommendationRankingTier.PRIMARY ? ++primaryRank : ++fallbackRank;
            ranked.add(new ValidatedRecommendationV3Response.Result(
                    result.jobId(), result.rankingTier(), persist(result.rankingScore()), persist(result.overallScore()),
                    persist(result.textScore()), persist(result.skillScore()), result.scoringStrategy(),
                    result.matchedSkills(), result.missingSkills(), result.reason(), index + 1, tierRank
            ));
        }
        return new ValidatedRecommendationV3Response(response.algorithm(), response.algorithmVersion(), List.copyOf(ranked));
    }

    private Map<Long, List<String>> normalizedJobs(Map<Long, List<String>> source) {
        Map<Long, List<String>> jobs = new HashMap<>();
        for (Map.Entry<Long, List<String>> entry : source.entrySet()) {
            if (entry.getKey() == null || entry.getKey() <= 0 || entry.getValue() == null
                    || jobs.putIfAbsent(entry.getKey(), List.copyOf(entry.getValue())) != null) {
                throw invalid();
            }
        }
        return jobs;
    }

    private RawResult validateResult(
            AiRecommendationV3Response.Result result,
            Map<Long, List<String>> jobs,
            Set<String> cvSkills,
            Set<Long> seen,
            BigDecimal threshold
    ) {
        if (result == null || result.jobId() == null || result.jobId() <= 0 || !seen.add(result.jobId())
                || result.rankingTier() == null || result.scoringStrategy() == null) {
            throw invalid();
        }
        List<String> jobSkills = jobs.get(result.jobId());
        if (jobSkills == null) {
            throw invalid();
        }
        BigDecimal rankingScore = score(result.rankingScore());
        BigDecimal skillScore = score(result.skillScore());
        if (rankingScore.compareTo(threshold) < 0) {
            throw invalid();
        }
        Skills evidence = evidence(result.matchedSkills(), result.missingSkills(), jobSkills, cvSkills);
        BigDecimal expectedSkill = jobSkills.isEmpty() ? BigDecimal.ZERO.setScale(AI_SCORE_SCALE)
                : BigDecimal.valueOf(evidence.matched().size()).divide(BigDecimal.valueOf(jobSkills.size()), AI_SCORE_SCALE, RoundingMode.HALF_UP);
        exact(skillScore, expectedSkill);
        if (!StringUtils.hasText(result.reason()) || result.reason().length() > MAX_REASON_LENGTH) {
            throw invalid();
        }
        if (result.rankingTier() == RecommendationRankingTier.PRIMARY) {
            if (result.scoringStrategy() != RecommendationScoringStrategy.SAME_LANGUAGE_HYBRID
                    || result.textScore() == null || result.overallScore() == null) {
                throw invalid();
            }
            BigDecimal text = score(result.textScore());
            BigDecimal overall = score(result.overallScore());
            exact(rankingScore, overall);
            if (jobSkills.isEmpty()) {
                exact(skillScore, BigDecimal.ZERO);
                exact(overall, text);
            } else {
                BigDecimal expected = TEXT_WEIGHT.multiply(text).add(SKILL_WEIGHT.multiply(skillScore))
                        .setScale(AI_SCORE_SCALE, RoundingMode.HALF_UP);
                if (overall.subtract(expected).abs().compareTo(FORMULA_ALLOWANCE) > 0) {
                    throw invalid();
                }
            }
            return new RawResult(result.jobId(), result.rankingTier(), rankingScore, overall, text, skillScore,
                    result.scoringStrategy(), evidence.matched(), evidence.missing(), result.reason().strip());
        }
        if (result.scoringStrategy() != RecommendationScoringStrategy.CROSS_LANGUAGE_SKILL_BASED
                || result.textScore() != null || result.overallScore() != null) {
            throw invalid();
        }
        exact(rankingScore, skillScore);
        if (jobSkills.isEmpty()) {
            exact(skillScore, BigDecimal.ZERO);
        }
        return new RawResult(result.jobId(), result.rankingTier(), rankingScore, null, null, skillScore,
                result.scoringStrategy(), evidence.matched(), evidence.missing(), result.reason().strip());
    }

    private Skills evidence(List<String> matched, List<String> missing, List<String> jobSkills, Set<String> cvSkills) {
        validateCanonicalSorted(matched);
        validateCanonicalSorted(missing);
        List<String> expectedMatched = jobSkills.stream().filter(cvSkills::contains).toList();
        List<String> expectedMissing = jobSkills.stream().filter(skill -> !cvSkills.contains(skill)).toList();
        if (!matched.equals(expectedMatched) || !missing.equals(expectedMissing)) {
            throw invalid();
        }
        return new Skills(List.copyOf(matched), List.copyOf(missing));
    }

    private void validateCanonicalSorted(List<String> skills) {
        if (skills == null || skills.size() > MAX_SKILLS) {
            throw invalid();
        }
        String previous = null;
        for (String skill : skills) {
            if (!StringUtils.hasText(skill) || skill.length() > MAX_SKILL_LENGTH
                    || !skill.equals(canonicalizer.canonicalize(skill))
                    || previous != null && previous.compareTo(skill) >= 0) {
                throw invalid();
            }
            previous = skill;
        }
    }

    private BigDecimal score(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0 || value.compareTo(BigDecimal.ONE) > 0) {
            throw invalid();
        }
        if (value.scale() > AI_SCORE_SCALE) {
            throw invalid();
        }
        return value;
    }

    private void exact(BigDecimal actual, BigDecimal expected) {
        if (actual.compareTo(expected) != 0) {
            throw invalid();
        }
    }

    private BigDecimal persist(BigDecimal value) {
        return value == null ? null : value.setScale(PERSISTENCE_SCORE_SCALE, RoundingMode.HALF_UP);
    }

    private AppException invalid() {
        return new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
    }

    private record Skills(List<String> matched, List<String> missing) {
    }

    private record RawResult(Long jobId, RecommendationRankingTier rankingTier, BigDecimal rankingScore,
                             BigDecimal overallScore, BigDecimal textScore, BigDecimal skillScore,
                             RecommendationScoringStrategy scoringStrategy, List<String> matchedSkills,
                             List<String> missingSkills, String reason) {
    }
}
