package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationResponse;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunDetailResponse;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationGenerationService;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RecommendationGenerationServiceImpl implements RecommendationGenerationService {

    private final RecommendationTransactionService transactionService;
    private final AiServiceClient aiServiceClient;
    private final AiRecommendationResponseValidator responseValidator;
    private final RecommendationQueryService recommendationQueryService;

    @Override
    public RecommendationRunDetailResponse generate(Long userId, GenerateRecommendationRequest request) {
        RecommendationGenerationContext context = transactionService.createProcessingRun(userId, request);

        try {
            AiRecommendationResponse response = aiServiceClient.recommend(context.request());
            ValidatedRecommendationResponse validated = responseValidator.validate(
                    context.request().requestId(),
                    context.eligibleJobIds(),
                    context.request().limit(),
                    response
            );
            transactionService.completeSuccess(context.runId(), validated);
            return recommendationQueryService.getMyRecommendationRun(userId, context.runId());
        } catch (RuntimeException exception) {
            transactionService.markFailed(context.runId(), exception);
            if (exception instanceof AppException appException) {
                throw appException;
            }
            throw new AppException(ErrorCode.RECOMMENDATION_GENERATION_FAILED);
        }
    }
}
