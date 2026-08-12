package com.tttn.jobrecommendation.modules.recommendation.service.impl;

import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.infrastructure.ai.client.AiServiceClient;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Request;
import com.tttn.jobrecommendation.infrastructure.ai.dto.AiRecommendationV3Response;
import com.tttn.jobrecommendation.modules.recommendation.dto.request.GenerateRecommendationRequest;
import com.tttn.jobrecommendation.modules.recommendation.dto.response.RecommendationRunDetailResponse;
import com.tttn.jobrecommendation.modules.recommendation.service.RecommendationQueryService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendationGenerationServiceImplTest {

    @Test
    void nonemptyFlowUsesV3OnlyAndCompletesValidatedResults() {
        Fixture fixture = fixture(contextWithJobs());
        AiRecommendationV3Response aiResponse = mock(AiRecommendationV3Response.class);
        ValidatedRecommendationV3Response validated = new ValidatedRecommendationV3Response(
                RecommendationV3Contract.ALGORITHM, RecommendationV3Contract.ALGORITHM_VERSION, List.of());
        RecommendationRunDetailResponse expected = RecommendationRunDetailResponse.builder().id(12L).build();
        when(fixture.ai.recommendV3(any())).thenReturn(aiResponse);
        when(fixture.validator.validate(any(), any(), any(), any(), any(Integer.class), eq(aiResponse))).thenReturn(validated);
        when(fixture.query.getMyRecommendationRun(99L, 12L)).thenReturn(expected);

        assertThat(fixture.service.generate(99L, request())).isSameAs(expected);

        verify(fixture.transaction).createProcessingRunV3(eq(99L), any(GenerateRecommendationRequest.class));
        verify(fixture.ai).recommendV3(any());
        verify(fixture.ai, never()).recommend(any());
        verify(fixture.transaction).completeSuccessV3(12L, validated);
    }

    @Test
    void emptyCorpusDoesNotCallEitherAiEndpointAndCompletesV3Metadata() {
        Fixture fixture = fixture(contextWithoutJobs());
        when(fixture.query.getMyRecommendationRun(99L, 12L)).thenReturn(RecommendationRunDetailResponse.builder().id(12L).build());

        fixture.service.generate(99L, request());

        verify(fixture.ai, never()).recommendV3(any());
        verify(fixture.ai, never()).recommend(any());
        verify(fixture.validator, never()).validate(any(), any(), any(), any(), any(Integer.class), any());
        org.mockito.ArgumentCaptor<ValidatedRecommendationV3Response> captured =
                org.mockito.ArgumentCaptor.forClass(ValidatedRecommendationV3Response.class);
        verify(fixture.transaction).completeSuccessV3(eq(12L), captured.capture());
        assertThat(captured.getValue().algorithm()).isEqualTo(RecommendationV3Contract.ALGORITHM);
        assertThat(captured.getValue().algorithmVersion()).isEqualTo(RecommendationV3Contract.ALGORITHM_VERSION);
        assertThat(captured.getValue().results()).isEmpty();
    }

    @Test
    void marksFailedWithoutPartialCompletionForAiAndValidationFailures() {
        for (RuntimeException failure : List.of(new AppException(ErrorCode.AI_SERVICE_TIMEOUT),
                new AppException(ErrorCode.AI_SERVICE_UNAVAILABLE), new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE))) {
            Fixture fixture = fixture(contextWithJobs());
            when(fixture.ai.recommendV3(any())).thenThrow(failure);
            assertThatThrownBy(() -> fixture.service.generate(99L, request())).isSameAs(failure);
            verify(fixture.transaction).markFailed(12L, failure);
            verify(fixture.transaction, never()).completeSuccessV3(any(), any());
            verify(fixture.ai, never()).recommend(any());
        }
        Fixture validatorFailure = fixture(contextWithJobs());
        AiRecommendationV3Response response = mock(AiRecommendationV3Response.class);
        AppException invalid = new AppException(ErrorCode.AI_SERVICE_INVALID_RESPONSE);
        when(validatorFailure.ai.recommendV3(any())).thenReturn(response);
        when(validatorFailure.validator.validate(any(), any(), any(), any(), any(Integer.class), eq(response))).thenThrow(invalid);
        assertThatThrownBy(() -> validatorFailure.service.generate(99L, request())).isSameAs(invalid);
        verify(validatorFailure.transaction).markFailed(12L, invalid);
        verify(validatorFailure.transaction, never()).completeSuccessV3(any(), any());
    }

    @Test
    void mapsUnexpectedFailureAfterMarkingRunFailed() {
        Fixture fixture = fixture(contextWithJobs());
        RuntimeException upstream = new IllegalStateException("unexpected");
        when(fixture.ai.recommendV3(any())).thenThrow(upstream);

        assertThatThrownBy(() -> fixture.service.generate(99L, request()))
                .isInstanceOfSatisfying(AppException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.RECOMMENDATION_GENERATION_FAILED));
        verify(fixture.transaction).markFailed(12L, upstream);
        verify(fixture.transaction, never()).completeSuccessV3(any(), any());
    }

    private Fixture fixture(RecommendationGenerationV3Context context) {
        RecommendationTransactionService transaction = mock(RecommendationTransactionService.class);
        AiServiceClient ai = mock(AiServiceClient.class);
        AiRecommendationV3ResponseValidator validator = mock(AiRecommendationV3ResponseValidator.class);
        RecommendationQueryService query = mock(RecommendationQueryService.class);
        when(transaction.createProcessingRunV3(eq(99L), any(GenerateRecommendationRequest.class))).thenReturn(context);
        return new Fixture(new RecommendationGenerationServiceImpl(transaction, ai, validator, query), transaction, ai, validator, query);
    }

    private RecommendationGenerationV3Context contextWithJobs() {
        AiRecommendationV3Request request = new AiRecommendationV3Request(UUID.randomUUID(),
                new AiRecommendationV3Request.CvInput(1L, "processed", List.of("java"), "en", BigDecimal.ONE,
                        RecommendationV3Contract.PROCESSING_VERSION),
                List.of(new AiRecommendationV3Request.JobInput(2L, "job", List.of("java"))), BigDecimal.ZERO, 20);
        return new RecommendationGenerationV3Context(12L, request, Map.of(2L, List.of("java")), List.of("java"));
    }

    private RecommendationGenerationV3Context contextWithoutJobs() {
        AiRecommendationV3Request request = new AiRecommendationV3Request(UUID.randomUUID(),
                new AiRecommendationV3Request.CvInput(1L, "processed", List.of(), "en", BigDecimal.ONE,
                        RecommendationV3Contract.PROCESSING_VERSION), List.of(), BigDecimal.ZERO, 20);
        return new RecommendationGenerationV3Context(12L, request, Map.of(), List.of());
    }

    private GenerateRecommendationRequest request() {
        GenerateRecommendationRequest request = new GenerateRecommendationRequest();
        request.setCvId(1L);
        request.setThreshold(BigDecimal.ZERO);
        request.setLimit(20);
        return request;
    }

    private record Fixture(RecommendationGenerationServiceImpl service, RecommendationTransactionService transaction,
                           AiServiceClient ai, AiRecommendationV3ResponseValidator validator, RecommendationQueryService query) {
    }
}
