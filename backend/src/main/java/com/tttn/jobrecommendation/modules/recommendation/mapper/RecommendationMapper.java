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
                .algorithm(null)
                .algorithmVersion(null)
                .totalJobsScanned(null)
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
                .score(result.getScore())
                .matchedKeywords(result.getMatchedKeywords())
                .reason(null)
                .createdAt(result.getCreatedAt())
                .build();
    }
}
