package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
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
    private final AiRecommendationV3ResponseValidator responseValidator;
    private final RecommendationQueryService recommendationQueryService;

    @Override
    public RecommendationRunDetailResponse generate(Long userId, GenerateRecommendationRequest request) {
        RecommendationGenerationV3Context context = transactionService.createProcessingRunV3(userId, request);

        try {
            ValidatedRecommendationV3Response validated;
            if (context.request().jobs().isEmpty()) {
                validated = new ValidatedRecommendationV3Response(
                        RecommendationV3Contract.ALGORITHM, RecommendationV3Contract.ALGORITHM_VERSION, java.util.List.of());
            } else {
                AiRecommendationV3Response response = aiServiceClient.recommendV3(context.request());
                validated = responseValidator.validate(
                        context.request().requestId(),
                        context.cvCanonicalSkills(),
                        context.jobSkillsById(),
                        context.request().threshold(),
                        context.request().limit(),
                        response
                );
            }
            transactionService.completeSuccessV3(context.runId(), validated);
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
