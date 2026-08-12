package com.tttn.jobrecommendation.modules.recommendation.mapper;

import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationResultResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunDetailResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunResponse;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationResult;
import com.tttn.jobrecommendation.modules.recommendation.entity.RecommendationRun;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class RecommendationMapper {

    public RecommendationRunResponse toRecommendationRunResponse(RecommendationRun run, Integer totalRecommended) {
        return RecommendationRunResponse.builder()
                .id(run.getId())
                .cvId(run.getCvFile() == null ? null : run.getCvFile().getId())
                .sourceType(run.getSourceType())
                .algorithm(run.getAlgorithm())
                .algorithmVersion(run.getAlgorithmVersion())
                .totalJobsScanned(run.getTotalJobsScanned())
                .totalRecommended(totalRecommended)
                .status(run.getStatus())
                .startedAt(run.getStartedAt())
                .finishedAt(run.getFinishedAt())
                .createdAt(run.getCreatedAt())
                .build();
    }

    public RecommendationRunDetailResponse toRecommendationRunDetailResponse(
            RecommendationRun run,
            List<RecommendationResultResponse> results
    ) {
        return RecommendationRunDetailResponse.builder()
                .id(run.getId())
                .cvId(run.getCvFile() == null ? null : run.getCvFile().getId())
                .sourceType(run.getSourceType())
                .algorithm(run.getAlgorithm())
                .algorithmVersion(run.getAlgorithmVersion())
                .totalJobsScanned(run.getTotalJobsScanned())
                .status(run.getStatus())
                .totalRecommended(results.size())
                .errorMessage(run.getErrorMessage())
                .startedAt(run.getStartedAt())
                .finishedAt(run.getFinishedAt())
                .createdAt(run.getCreatedAt())
                .results(results)
                .build();
    }

    public RecommendationResultResponse toRecommendationResultResponse(RecommendationResult result) {
        return RecommendationResultResponse.builder()
                .id(result.getId())
                .jobId(result.getJob().getId())
                .jobTitle(result.getJob().getTitle())
                .companyName(result.getJob().getCompany().getCompanyName())
                .rankPosition(result.getRankPosition())
                .tierRankPosition(result.getTierRankPosition())
                .rankingTier(result.getRankingTier())
                .rankingScore(result.getRankingScore())
                .overallScore(result.getOverallScore())
                .score(result.getRankingScore())
                .textScore(result.getTextScore())
                .skillScore(result.getSkillScore())
                .scoringStrategy(result.getScoringStrategy())
                .matchedKeywords(copyOrEmpty(result.getMatchedKeywords()))
                .missingSkills(copyOrEmpty(result.getMissingSkills()))
                .reason(result.getReason())
                .createdAt(result.getCreatedAt())
                .build();
    }

    private List<String> copyOrEmpty(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
